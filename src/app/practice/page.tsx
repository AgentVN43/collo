"use client";

import { Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import BottomSheet from "@/components/BottomSheet";
import CollocationDetail, { RegisterBadge } from "@/components/CollocationDetail";
import TileOrder from "@/components/TileOrder";
import SpeakButton from "@/components/SpeakButton";
import { getSupabase } from "@/lib/supabase";
import { fetchWords } from "@/lib/words";
import { fetchCollocations } from "@/lib/collocations";
import { useSession } from "@/lib/useSession";
import { type GradeResult } from "@/lib/grading";
import { applySession, buildQueue, emptyRow, SOLID_THRESHOLD } from "@/lib/progress";
import { getEnabledCategories, getPracticeSettings, type PracticeSettings } from "@/lib/settings";
import { collectionWordIds, fetchCollections, type CollectionWithCount } from "@/lib/collections";
import { buildItem, shuffle, STAGE_LABEL, type SessionItem } from "@/lib/practiceItem";
import {
  currentItem,
  currentStage,
  emptySession,
  hasNextStage,
  isSessionEnd,
  planAfter,
  reduce,
  willScaffold,
} from "@/lib/practiceSession";
import { REGISTER_LABELS, type Collocation, type ProgressRow, type Word } from "@/lib/types";

/** Điều hướng màn hình. Luật của phiên nằm trong lib/practiceSession, không nằm ở đây. */
type Phase = "menu" | "pick" | "run" | "summary";

type Scope =
  | { type: "all" }
  | { type: "word"; id: string }
  | { type: "collocation"; id: string }
  | { type: "collection"; id: string };

const RESULT_STYLE: Record<GradeResult, string> = {
  correct: "border-green-500 bg-green-50",
  near: "border-yellow-500 bg-yellow-50",
  wrong: "border-red-500 bg-red-50",
};

function PracticeSession() {
  const params = useSearchParams();
  const wordParam = params.get("word");
  const collocationParam = params.get("collocation");
  const collectionParam = params.get("collection");
  const { userId, loading: authLoading } = useSession();
  const supabase = getSupabase();

  // Dữ liệu nền
  const [words, setWords] = useState<Word[]>([]);
  const [collocations, setCollocations] = useState<Collocation[]>([]);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [enabledCategories, setEnabledCategoriesState] = useState<string[] | null>(null);
  const [settings, setSettings] = useState<PracticeSettings | null>(null);

  // Điều hướng
  const [phase, setPhase] = useState<Phase>("menu");
  const [scope, setScope] = useState<Scope>({ type: "all" });
  const [poolError, setPoolError] = useState<string | null>(null);
  const [collections, setCollections] = useState<CollectionWithCount[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** Phạm vi từ đơn của phiên đang chạy — để "Luyện tiếp" dựng phiên mới cùng phạm vi. */
  const [scopeIds, setScopeIds] = useState<Set<string> | null>(null);
  /** Các cụm đã luyện xong trong lượt ngồi này (không reset giữa các phiên liên tiếp). */
  const [practiced, setPracticed] = useState<Set<string>>(new Set());

  // Toàn bộ trạng thái phiên gói trong MỘT đối tượng, mọi chuyển tiếp là hàm thuần
  const [session, dispatch] = useReducer(reduce, undefined, emptySession);

  const deepLinked = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("categories")
      .select("slug")
      .then(({ data }) => {
        const slugs = ((data as { slug: string }[]) ?? []).map((c) => c.slug);
        setEnabledCategoriesState(getEnabledCategories(slugs));
      });
    setSettings(getPracticeSettings());
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !userId) return;
    Promise.all([
      fetchWords(supabase),
      fetchCollocations(supabase),
      supabase.from("progress").select("*"),
    ]).then(([w, c, p]) => {
      setWords(w);
      setCollocations(c);
      setRows((p.data as ProgressRow[]) ?? []);
      setLoaded(true);
    });
  }, [supabase, userId]);

  // Deep link chỉ đặt PHẠM VI — chặng nào thì do mastery quyết định
  useEffect(() => {
    if (deepLinked.current) return;
    if (wordParam) {
      deepLinked.current = true;
      setScope({ type: "word", id: wordParam });
    } else if (collocationParam) {
      deepLinked.current = true;
      setScope({ type: "collocation", id: collocationParam });
    } else if (collectionParam) {
      deepLinked.current = true;
      setScope({ type: "collection", id: collectionParam });
    }
  }, [wordParam, collocationParam, collectionParam]);

  /** Collocation luyện được: category đang bật trong Settings. */
  const practicableCollocations = useMemo(
    () =>
      collocations.filter(
        (c) => !enabledCategories || !c.category_slug || enabledCategories.includes(c.category_slug)
      ),
    [collocations, enabledCategories]
  );

  /** Kích hoạt dòng progress khi bắt đầu một mục (giữ cơ chế "activation row" như cũ). */
  const activate = useCallback(
    async (item: SessionItem, allRows: ProgressRow[]) => {
      if (!supabase || !userId) return;
      const exists = allRows.some(
        (r) => r.item_type === "collocation" && r.item_id === item.collocation.id
      );
      if (exists) return;
      const row = emptyRow(userId, "collocation", item.collocation.id);
      setRows((prev) => [...prev, row]);
      await supabase
        .from("progress")
        .upsert(row, { onConflict: "user_id,item_type,item_id", ignoreDuplicates: true });
    },
    [supabase, userId]
  );

  const beginSession = useCallback(
    (list: SessionItem[], drill = false) => {
      if (list.length === 0) {
        setPoolError(
          "Không có collocation nào luyện được trong phạm vi này — kiểm tra Settings → Category to Practice."
        );
        setPhase("menu");
        return;
      }
      setPoolError(null);
      dispatch({ type: "begin", items: list, drill });
      setPhase("run");
      activate(list[0], rows);
    },
    [rows, activate]
  );

  /**
   * Chọn N mục theo hàng đợi ưu tiên rồi xáo thứ tự hiển thị.
   *
   * `exclude` loại các cụm vừa luyện xong trong lượt ngồi này. Cần thiết vì `buildQueue`
   * đẩy cụm fail-rate cao lên ưu tiên 3000 — không lọc thì bấm "Luyện tiếp" sẽ gặp lại
   * ngay đúng cụm vừa sai, mà nhớ lại sau 30 giây thì không chứng minh được điều gì.
   */
  const buildPool = useCallback(
    (scopeWordIds?: Set<string>, exclude?: Set<string>): SessionItem[] => {
      const n = settings?.quantity ?? 5;
      let pool = practicableCollocations;
      if (scopeWordIds) {
        pool = pool.filter((c) => c.word_ids.some((id) => scopeWordIds.has(id)));
      }
      if (exclude) pool = pool.filter((c) => !exclude.has(c.id));
      const queued = buildQueue(pool, rows, "collocation");
      return shuffle(queued.slice(0, n)).map((c) => buildItem(c, words, collocations, rows));
    },
    [practicableCollocations, collocations, rows, words, settings]
  );

  const startCollection = useCallback(
    async (collectionId: string) => {
      if (!supabase) return;
      const ids = await collectionWordIds(supabase, collectionId);
      if (ids.size === 0) {
        setPoolError("Bộ sưu tập này chưa có từ nào — bấm 🔖 ở Home để thêm từ vào.");
        setPhase("menu");
        return;
      }
      setScopeIds(ids);
      beginSession(buildPool(ids, practiced));
    },
    [supabase, beginSession, buildPool, practiced]
  );

  const start = useCallback(async () => {
    setPoolError(null);
    // Phạm vi 1 từ: luyện các cụm CHỨA từ đó — bản thân từ đơn không còn là bài tập
    if (scope.type === "word") {
      const target = words.find((w) => w.id === scope.id);
      if (!target) {
        setPoolError("Không tìm thấy từ này.");
        return;
      }
      const ids = new Set([target.id]);
      setScopeIds(ids);
      beginSession(buildPool(ids, practiced));
      return;
    }
    if (scope.type === "collocation") {
      const target = collocations.find((c) => c.id === scope.id);
      if (!target) {
        setPoolError("Không tìm thấy cụm từ này.");
        return;
      }
      // Chọn đích danh một cụm = muốn luyện kỹ cụm ĐÓ, chạy hết thang trong một phiên
      setScopeIds(null);
      beginSession([buildItem(target, words, collocations, rows, true)], true);
      return;
    }
    if (scope.type === "collection") {
      startCollection(scope.id);
      return;
    }
    if (settings?.mode === "collection") {
      setPhase("pick");
      if (collections === null && supabase) setCollections(await fetchCollections(supabase));
    } else {
      setScopeIds(null);
      beginSession(buildPool(undefined, practiced));
    }
  }, [
    scope,
    words,
    collocations,
    rows,
    settings,
    collections,
    supabase,
    practiced,
    beginSession,
    buildPool,
    startCollection,
  ]);

  const item = currentItem(session);
  const stage = currentStage(session);

  /** Lưu kết quả một mục, trả về bậc mastery trước và sau để tổng kết đối chiếu. */
  const saveItem = async (target: SessionItem) => {
    const existing =
      rows.find((r) => r.item_type === "collocation" && r.item_id === target.collocation.id) ??
      emptyRow(userId ?? "", "collocation", target.collocation.id);
    const updated = applySession(existing, session.tally);
    setRows((prev) => [
      ...prev.filter(
        (r) => !(r.item_type === "collocation" && r.item_id === target.collocation.id)
      ),
      updated,
    ]);
    setPracticed((prev) => new Set(prev).add(target.collocation.id));
    if (supabase && userId) {
      await supabase.from("progress").upsert(updated, { onConflict: "user_id,item_type,item_id" });
    }
    return { before: existing.mastery, after: updated.mastery };
  };

  /** Hết chặng của cụm này → chốt sổ rồi sang cụm kế. */
  const goNextItem = async () => {
    if (!item) return;
    const { before, after } = await saveItem(item);
    dispatch({ type: "nextItem", before, after });
    const nextIdx = session.idx + 1;
    if (nextIdx < session.items.length) activate(session.items[nextIdx], rows);
    else setPhase("summary");
  };

  /** Cụm cuối đã xong: dừng lại xem tổng kết, hoặc vào thẳng phiên mới. */
  const endSession = async (then: "summary" | "continue") => {
    if (!item) return;
    const { before, after } = await saveItem(item);
    dispatch({ type: "nextItem", before, after });
    if (then === "summary") {
      setPhase("summary");
      return;
    }
    // `practiced` chưa kịp cập nhật trong lượt render này nên cộng tay mục vừa xong
    const skip = new Set(practiced).add(item.collocation.id);
    const pool = buildPool(scopeIds ?? undefined, skip);
    if (pool.length === 0) {
      setPoolError(
        "Hết cụm mới trong phạm vi này rồi — nghỉ một lát, để cách ngày rồi ôn lại sẽ nhớ lâu hơn."
      );
      setPhase("summary");
      return;
    }
    beginSession(pool);
  };

  // ===== Render =====
  if (!supabase)
    return (
      <p className="m-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
        Chưa cấu hình Supabase (.env.local).
      </p>
    );
  if (authLoading) return <p className="p-6 text-center text-gray-400">Đang tải…</p>;
  if (!userId)
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-gray-600">Đăng nhập để luyện tập và lưu tiến độ của bạn.</p>
        <Link
          href="/login?next=/practice"
          className="inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-white font-semibold"
        >
          Đăng nhập
        </Link>
      </div>
    );
  if (!loaded || settings === null)
    return <p className="p-6 text-center text-gray-400">Đang chuẩn bị…</p>;

  // ---- Màn chọn bài ----
  if (phase === "menu") {
    const scopeLabel =
      scope.type === "word"
        ? words.find((w) => w.id === scope.id)?.word
        : scope.type === "collocation"
          ? collocations.find((c) => c.id === scope.id)?.chunk
          : scope.type === "collection"
            ? "bộ sưu tập đã chọn"
            : null;
    return (
      <div className="px-4 py-4 space-y-3">
        {poolError && (
          <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            {poolError}
          </p>
        )}
        {scope.type !== "all" && (
          <div className="flex items-center rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <span className="flex-1">
              Phạm vi: <b>{scopeLabel ?? "…"}</b>
            </span>
            <button onClick={() => setScope({ type: "all" })} className="ml-2 text-blue-600">
              ✕ Bỏ
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 p-4">
          <h2 className="text-lg font-bold text-gray-900">✍️ Luyện tập</h2>
          <p className="mt-1 text-sm text-gray-500">
            {scope.type === "all"
              ? `Phiên ${settings.quantity} cụm · ${
                  settings.mode === "free" ? "random toàn kho theo lịch ôn" : "theo bộ sưu tập"
                }`
              : "Luyện trong phạm vi đang chọn"}
          </p>
          {settings.mode === "collection" && scope.type === "all" && (
            <p className="mt-2 text-xs text-amber-600">
              Hãy nhớ tạo list học tập trước khi luyện tập nhé 📚
            </p>
          )}
          <button
            onClick={start}
            className="mt-3 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white active:bg-blue-700"
          >
            Bắt đầu
          </button>
          <p className="mt-3 text-xs text-gray-400">
            {scope.type === "collocation"
              ? "Luyện kỹ đúng cụm này: quét nhanh → xếp hình → tự nhớ ra → thực chiến."
              : "Cụm mới thì quét nhanh rồi xếp hình; cụm đã quen thì phải tự nhớ ra. Càng thuộc, bài càng khó."}
          </p>
        </div>

        <p className="text-center text-xs text-gray-400">
          Đổi chế độ và số mục mỗi phiên trong{" "}
          <Link href="/settings" className="text-blue-600">
            Settings
          </Link>
        </p>
      </div>
    );
  }

  // ---- Chọn bộ sưu tập ----
  if (phase === "pick") {
    return (
      <div className="px-4 py-4 space-y-2">
        <h2 className="font-semibold text-gray-900">Chọn bộ sưu tập</h2>
        {collections === null ? (
          <p className="py-6 text-center text-gray-400">Đang tải…</p>
        ) : collections.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-gray-500">
              Chưa có bộ sưu tập nào. Hãy nhớ tạo list học tập trước khi luyện tập nhé 📚
            </p>
            <Link
              href="/collections"
              className="inline-block rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white"
            >
              Tạo bộ sưu tập
            </Link>
          </div>
        ) : (
          collections.map((c) => (
            <button
              key={c.id}
              onClick={() => startCollection(c.id)}
              className="flex w-full items-center rounded-xl border border-gray-200 px-4 py-3 text-left"
            >
              <span className="mr-3 text-2xl">📚</span>
              <span className="flex-1 min-w-0">
                <span className="block truncate font-semibold text-gray-900">{c.name}</span>
                <span className="text-xs text-gray-400">{c.word_count} từ</span>
              </span>
              <span className="text-gray-300">›</span>
            </button>
          ))
        )}
        <button onClick={() => setPhase("menu")} className="w-full py-2 text-sm text-gray-500">
          ← Quay lại
        </button>
      </div>
    );
  }

  // ---- Tổng kết: đo bằng MASTERY, không phải % của riêng phiên ----
  // Cày mười phiên mà không cụm nào lên bậc thì % đẹp cũng vô nghĩa — con số phải nói thẳng.
  if (phase === "summary") {
    const log = session.log;
    const up = log.filter((l) => l.after > l.before).length;
    const down = log.filter((l) => l.after < l.before).length;
    const flat = log.length - up - down;
    const solid = log.filter((l) => l.after >= SOLID_THRESHOLD).length;
    return (
      <div className="px-4 py-6 space-y-4">
        {poolError && (
          <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-left text-sm text-amber-800">
            {poolError}
          </p>
        )}
        <div className="text-center">
          <p className="text-5xl">{up > 0 ? "🎉" : down > 0 ? "📖" : "💪"}</p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {up > 0 ? `${up} cụm lên bậc` : "Chưa cụm nào lên bậc"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {log.length} cụm đã luyện · {flat} giữ nguyên · {down} tụt bậc
            {solid > 0 && ` · ${solid} đã thành thạo`}
          </p>
          {up === 0 && log.length > 0 && (
            <p className="mt-2 text-sm text-amber-700">
              Luyện nhiều mà không lên bậc thì chưa thật sự thuộc — để cách ngày rồi ôn lại sẽ vào
              hơn là cày liên tục.
            </p>
          )}
        </div>

        <ul className="space-y-1.5">
          {[...log]
            .sort((a, b) => a.after - b.after || a.score - b.score)
            .map((l, i) => (
              <li key={i} className="flex items-center rounded-xl border border-gray-100 px-3 py-2">
                <span className="flex-1 font-semibold text-gray-900">{l.title}</span>
                <span
                  className={`text-sm font-semibold ${
                    l.after > l.before
                      ? "text-green-600"
                      : l.after < l.before
                        ? "text-red-500"
                        : "text-gray-400"
                  }`}
                >
                  {l.after > l.before ? "↑" : l.after < l.before ? "↓" : "="} bậc {l.after}/5
                </span>
              </li>
            ))}
        </ul>

        <div className="flex gap-2">
          <Link
            href="/"
            className="flex-1 rounded-2xl border border-gray-300 py-3 text-center font-semibold text-gray-700"
          >
            Về Home
          </Link>
          <button
            onClick={() => {
              setPoolError(null);
              setPhase("menu");
            }}
            className="flex-1 rounded-2xl bg-blue-600 py-3 font-semibold text-white"
          >
            Phiên mới
          </button>
        </div>
      </div>
    );
  }

  if (!item || !stage)
    return <p className="p-6 text-center text-gray-400">Đang chuẩn bị bài luyện…</p>;

  const { result, note } = session;
  const header = (
    <div className="pt-4 pb-2 text-center">
      <p className="text-xs font-semibold text-gray-400">
        Cụm {session.idx + 1}/{session.items.length} · {STAGE_LABEL[stage]}
      </p>
    </div>
  );

  // ---- Quét nhanh: chỉ nhận mặt chữ, KHÔNG chấm điểm, không lộ chunk ----
  if (stage === "scan") {
    return (
      <div className="px-4 pb-8">
        {header}
        <div className="mt-1 rounded-2xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Lướt qua cho quen mặt chữ thôi — không cần thuộc.</p>
          {item.scanWords.length === 0 ? (
            <p className="mt-3 rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500">
              Cụm này chưa liên kết từ đơn nào.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {item.scanWords.map((w) => (
                <li key={w.id} className="rounded-xl border border-gray-100 px-3 py-2">
                  <p className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-gray-900">{w.word}</span>
                    <SpeakButton text={w.word} className="text-base" />
                    <span className="text-sm italic text-gray-500">{w.word_type}</span>
                  </p>
                  <p className="text-sm text-gray-700">{w.meaning_vi}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => dispatch({ type: "advance" })}
          className="mt-4 w-full rounded-2xl bg-blue-600 py-3.5 text-lg font-semibold text-white active:bg-blue-700"
        >
          Bắt đầu luyện →
        </button>
      </div>
    );
  }

  const nextStage = planAfter(session)[session.stageIdx + 1];
  const feedback = result && (
    <div className="mt-3 space-y-3">
      <div
        className={`rounded-xl p-3 text-sm ${
          result === "correct"
            ? "bg-green-50 text-green-800"
            : result === "near"
              ? "bg-yellow-50 text-yellow-800"
              : "bg-red-50 text-red-800"
        }`}
      >
        {/* Nghe lại nguyên cụm sau khi đã trả lời — nhại theo là bước cuối của mỗi lần sản sinh */}
        <p className="flex items-start gap-1.5 font-semibold">
          <span className="flex-1">
            {result === "correct"
              ? `✅ Chính xác! ${item.collocation.chunk}`
              : result === "near"
                ? `🟡 Gần đúng. Đáp án: ${item.collocation.chunk}`
                : `❌ Đáp án: ${item.collocation.chunk}`}
          </span>
          <SpeakButton text={item.collocation.chunk} className="shrink-0 text-base" />
        </p>
        {stage === "scenario" && item.scenario && (
          <p className="mt-1 flex items-start gap-1.5 font-normal">
            <span className="flex-1">Cách nói mẫu: “{item.scenario.model}”</span>
            <SpeakButton text={item.scenario.model} className="shrink-0 text-base" />
          </p>
        )}
        {willScaffold(session) && (
          <p className="mt-1 font-normal">Lùi lại một bậc cho chắc — ghép thẻ lại cụm này đã.</p>
        )}
        {note && <p className="mt-1 font-normal">{note}</p>}
        {item.collocation.note_vi && <p className="mt-1 font-normal">{item.collocation.note_vi}</p>}
      </div>

      {isSessionEnd(session) ? (
        // Cụm cuối: không bắt qua màn tổng kết mới luyện tiếp được.
        // Phiên luyện kỹ một cụm thì không có "luyện tiếp" — nhảy sang cụm khác là
        // lặng lẽ phá phạm vi mà người học đã chọn.
        <div className="flex gap-2">
          <button
            onClick={() => endSession("summary")}
            className={`rounded-2xl border border-gray-300 py-3.5 font-semibold text-gray-700 ${
              session.drill ? "w-full" : "flex-1"
            }`}
          >
            Kết thúc
          </button>
          {!session.drill && (
            <button
              onClick={() => endSession("continue")}
              className="flex-1 rounded-2xl bg-blue-600 py-3.5 text-lg font-semibold text-white"
            >
              Luyện tiếp →
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => (hasNextStage(session) ? dispatch({ type: "advance" }) : goNextItem())}
          className="w-full rounded-2xl bg-blue-600 py-3.5 text-lg font-semibold text-white"
        >
          {nextStage ? `Tiếp: ${STAGE_LABEL[nextStage]}` : "Cụm tiếp theo →"}
        </button>
      )}
    </div>
  );

  // Chỉ mở "Lý thuyết" SAU khi đã trả lời — sheet hiện nguyên chunk ngay dòng đầu
  const theoryButton = result && (
    <button
      onClick={() => setSheetOpen(true)}
      aria-label="Ôn lý thuyết"
      className="rounded-full bg-gray-100 px-3 py-1.5 text-sm"
    >
      📖 Lý thuyết
    </button>
  );

  const sheet = (
    <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
      <CollocationDetail collocation={item.collocation} />
    </BottomSheet>
  );

  // ---- Xếp hình ----
  if (stage === "unscramble") {
    return (
      <div className="px-4 pb-8">
        {header}
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">
            {result ? item.collocation.chunk : "• • •"}
          </p>
          <p className="text-sm text-gray-500">{item.collocation.literal_meaning}</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <RegisterBadge register={item.collocation.register} />
            {theoryButton}
          </div>
        </div>

        <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5 text-gray-800">
          Ghép các thẻ thành cụm tiếng Anh đúng thứ tự.
        </p>
        <TileOrder
          tiles={item.tiles}
          value={session.placed}
          onChange={(v) => dispatch({ type: "setPlaced", value: v })}
          disabled={!!result}
        />

        {!result && (
          <button
            onClick={() => dispatch({ type: "submit" })}
            disabled={session.placed.length === 0}
            className="mt-4 w-full rounded-2xl bg-blue-600 py-3.5 text-lg font-semibold text-white disabled:bg-gray-300"
          >
            Kiểm tra
          </button>
        )}
        {feedback}
        {sheet}
      </div>
    );
  }

  // ---- Vắt óc nhớ / Thực chiến: cùng một thao tác, khác gợi ý ----
  const typingBox = (
    <>
      <input
        value={session.input}
        disabled={!!result}
        onChange={(e) => dispatch({ type: "setInput", value: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && dispatch({ type: "submit" })}
        placeholder={stage === "scenario" ? "Gõ câu đáp lại…" : "Gõ cụm tiếng Anh…"}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className={`mt-4 w-full rounded-xl border-2 px-4 py-3 text-lg outline-none ${
          result ? RESULT_STYLE[result] : "border-gray-200 focus:border-blue-500"
        }`}
      />
      {!result && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => dispatch({ type: "giveUp" })}
            className="rounded-2xl border border-gray-300 px-4 py-3.5 font-semibold text-gray-600"
          >
            Chịu
          </button>
          <button
            onClick={() => dispatch({ type: "submit" })}
            disabled={!session.input.trim()}
            className="flex-1 rounded-2xl bg-blue-600 py-3.5 text-lg font-semibold text-white disabled:bg-gray-300"
          >
            Kiểm tra
          </button>
        </div>
      )}
    </>
  );

  if (stage === "scenario" && item.scenario) {
    return (
      <div className="px-4 pb-8">
        {header}
        <div className="space-y-2">
          {item.scenario.context.map((t, i) => (
            <div key={i} className="rounded-xl border border-gray-200 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase text-gray-400">{t.speaker}</p>
              <p className="text-gray-900">{t.text}</p>
              {t.translate && <p className="mt-0.5 text-sm text-gray-500">{t.translate}</p>}
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2.5">
          <p className="text-sm text-blue-900">
            Bạn là <b>{item.scenario.speaker}</b>. Đáp lại bằng cách nói{" "}
            <b>{REGISTER_LABELS[item.collocation.register].toLowerCase()}</b> mang nghĩa:
          </p>
          <p className="mt-0.5 font-semibold text-blue-900">{item.collocation.literal_meaning}</p>
          <p className="mt-1 text-xs text-blue-700">
            Đáp thành câu hoàn chỉnh cũng được — chỉ cần có cụm trong đó.
          </p>
        </div>
        {typingBox}
        {result && <div className="mt-2 flex justify-center">{theoryButton}</div>}
        {feedback}
        {sheet}
      </div>
    );
  }

  // ---- Vắt óc nhớ ----
  return (
    <div className="px-4 pb-8">
      {header}
      <div className="text-center">
        {item.collocation.intent && (
          <p className="text-xs font-semibold uppercase text-purple-500">
            🎯 {item.collocation.intent.name_vi}
          </p>
        )}
        <p className="mt-1 text-xl font-semibold text-gray-900">
          {item.collocation.literal_meaning}
        </p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <RegisterBadge register={item.collocation.register} />
          {theoryButton}
        </div>
      </div>

      <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5 text-gray-800">
        Không nhìn gợi ý — tự nhớ ra cụm tiếng Anh và gõ lại.
      </p>
      {typingBox}
      {feedback}
      {sheet}
    </div>
  );
}

export default function PracticePage() {
  return (
    <div>
      <TopBar title="Practice" />
      <Suspense fallback={<p className="p-6 text-center text-gray-400">Đang tải…</p>}>
        <PracticeSession />
      </Suspense>
    </div>
  );
}
