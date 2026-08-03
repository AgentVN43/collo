"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import BottomSheet from "@/components/BottomSheet";
import WordDetail from "@/components/WordDetail";
import CollocationDetail from "@/components/CollocationDetail";
import FeedbackSheet from "@/components/FeedbackSheet";
import { getSupabase } from "@/lib/supabase";
import { fetchWords } from "@/lib/words";
import { fetchCollocations } from "@/lib/collocations";
import { useSession } from "@/lib/useSession";
import { grade, type GradeResult } from "@/lib/grading";
import { applySession, buildQueue, emptyRow, isUnlocked, type SessionResult } from "@/lib/progress";
import { getEnabledCategories, getPracticeSettings, type PracticeSettings } from "@/lib/settings";
import { collectionWordIds, fetchCollections, type CollectionWithCount } from "@/lib/collections";
import type { Collocation, Exercise, ProgressItemType, ProgressRow, Word } from "@/lib/types";
import { SUPPORTED_EXERCISE_TYPES } from "@/lib/types";

type Phase = "menu" | "pick" | "run" | "summary";
type Level = 1 | 2;
type Scope =
  | { type: "all" }
  | { type: "word"; id: string }
  | { type: "collocation"; id: string }
  | { type: "collection"; id: string };

/** Bài tập đã chuẩn hoá để chạy — từ DB hoặc sinh tự động. */
interface RunnableExercise {
  key: string;
  type: "fill_in" | "multiple_choice";
  prompt: string;
  before: string;
  after: string;
  answer: string;
  alt: string[];
  explain_vi: string;
  pattern: string;
  options: string[];
}

/** Một mục trong phiên luyện — từ đơn (Level 1) hoặc collocation (Level 2). */
interface SessionItem {
  id: string;
  itemType: ProgressItemType;
  title: string;
  subtitle: string;
  exercises: RunnableExercise[];
  word?: Word;
  collocation?: Collocation;
}

interface ItemLog {
  title: string;
  correct: number;
  near: number;
  wrong: number;
}

const RESULT_STYLE: Record<GradeResult, string> = {
  correct: "border-green-500 bg-green-50",
  near: "border-yellow-500 bg-yellow-50",
  wrong: "border-red-500 bg-red-50",
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pct = (t: { correct: number; near: number; wrong: number }) => {
  const total = t.correct + t.near + t.wrong;
  return total === 0 ? 0 : Math.round(((t.correct + t.near * 0.5) / total) * 100);
};

/** Đổi Exercise trong DB thành dạng chạy được; bỏ qua dạng chưa có UI chấm điểm. */
function toRunnable(ex: Exercise): RunnableExercise | null {
  if (!SUPPORTED_EXERCISE_TYPES.includes(ex.type)) return null;
  return {
    key: ex.id,
    type: ex.type as "fill_in" | "multiple_choice",
    prompt: ex.prompt,
    before: typeof ex.payload?.before === "string" ? ex.payload.before : "",
    after: typeof ex.payload?.after === "string" ? ex.payload.after : "",
    answer: ex.answer,
    alt: ex.alt ?? [],
    explain_vi: ex.explain_vi,
    pattern: ex.pattern,
    options: Array.isArray(ex.payload?.options) ? (ex.payload.options as string[]) : [],
  };
}

/** Không có bài soạn sẵn → sinh bài mặc định "cho nghĩa tiếng Việt, gõ tiếng Anh". */
function fallbackExercise(id: string, prompt: string, answer: string, explain: string): RunnableExercise {
  return {
    key: `auto-${id}`,
    type: "fill_in",
    prompt,
    before: "",
    after: "",
    answer,
    alt: [],
    explain_vi: explain,
    pattern: "",
    options: [],
  };
}

function buildWordItem(w: Word, exercises: Exercise[]): SessionItem {
  const own = exercises.filter((e) => e.word_id === w.id).map(toRunnable).filter(Boolean) as RunnableExercise[];
  return {
    id: w.id,
    itemType: "word",
    title: w.word,
    subtitle: w.meaning_vi,
    word: w,
    exercises:
      own.length > 0 ? own : [fallbackExercise(w.id, w.meaning_vi, w.word, w.meaning_en)],
  };
}

function buildCollocationItem(c: Collocation): SessionItem {
  const own = c.exercises.map(toRunnable).filter(Boolean) as RunnableExercise[];
  return {
    id: c.id,
    itemType: "collocation",
    title: c.chunk,
    subtitle: c.literal_meaning,
    collocation: c,
    exercises:
      own.length > 0
        ? own
        : [fallbackExercise(c.id, c.literal_meaning, c.chunk, c.note_vi)],
  };
}

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
  const [wordExercises, setWordExercises] = useState<Exercise[]>([]);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [enabledCategories, setEnabledCategoriesState] = useState<string[] | null>(null);
  const [settings, setSettings] = useState<PracticeSettings | null>(null);

  // Phiên luyện
  const [phase, setPhase] = useState<Phase>("menu");
  const [sessionLevel, setSessionLevel] = useState<Level>(1);
  const [scope, setScope] = useState<Scope>({ type: "all" });
  const [pendingLevel, setPendingLevel] = useState<Level>(1);
  const [items, setItems] = useState<SessionItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [log, setLog] = useState<ItemLog[]>([]);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [collections, setCollections] = useState<CollectionWithCount[] | null>(null);

  // Mục đang luyện
  const [exIndex, setExIndex] = useState(0);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [tally, setTally] = useState<SessionResult>({ correct: 0, near: 0, wrong: 0 });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

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
      supabase.from("exercises").select("*").not("word_id", "is", null),
    ]).then(([w, c, p, ex]) => {
      setWords(w);
      setCollocations(c);
      setRows((p.data as ProgressRow[]) ?? []);
      setWordExercises((ex.data as Exercise[]) ?? []);
      setLoaded(true);
    });
  }, [supabase, userId]);

  // Deep link chỉ đặt PHẠM VI — người học vẫn tự chọn Level ở menu
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

  const resetItemState = () => {
    setExIndex(0);
    setInput("");
    setResult(null);
    setTally({ correct: 0, near: 0, wrong: 0 });
  };

  /** Kích hoạt dòng progress khi bắt đầu một mục (giữ cơ chế "activation row" như cũ). */
  const activate = useCallback(
    async (item: SessionItem, allRows: ProgressRow[]) => {
      if (!supabase || !userId) return;
      const exists = allRows.some(
        (r) => r.item_type === item.itemType && r.item_id === item.id
      );
      if (exists) return;
      const row = emptyRow(userId, item.itemType, item.id);
      setRows((prev) => [...prev, row]);
      await supabase
        .from("progress")
        .upsert(row, { onConflict: "user_id,item_type,item_id", ignoreDuplicates: true });
    },
    [supabase, userId]
  );

  const beginSession = useCallback(
    (list: SessionItem[], level: Level) => {
      if (list.length === 0) {
        setPoolError(
          level === 2
            ? "Không có collocation nào luyện được trong phạm vi này — kiểm tra Settings → Category to Practice."
            : "Không có từ đơn nào luyện được trong phạm vi này."
        );
        setPhase("menu");
        return;
      }
      setPoolError(null);
      setSessionLevel(level);
      setItems(list);
      setIdx(0);
      setLog([]);
      resetItemState();
      setPhase("run");
      activate(list[0], rows);
    },
    [rows, activate]
  );

  /** Chọn N mục theo hàng đợi ưu tiên rồi xáo thứ tự hiển thị. */
  const buildPool = useCallback(
    (level: Level, scopeWordIds?: Set<string>): SessionItem[] => {
      const n = settings?.quantity ?? 5;
      if (level === 1) {
        const pool = scopeWordIds ? words.filter((w) => scopeWordIds.has(w.id)) : words;
        return shuffle(buildQueue(pool, rows, "word").slice(0, n)).map((w) =>
          buildWordItem(w, wordExercises)
        );
      }
      let pool = practicableCollocations;
      if (scopeWordIds) {
        pool = pool.filter((c) => c.word_ids.some((id) => scopeWordIds.has(id)));
      }
      // Collocation đã mở khoá được đẩy lên đầu hàng đợi (ưu tiên mềm, không khoá cứng)
      const queued = buildQueue(pool, rows, "collocation", (c) => (isUnlocked(c, rows) ? 2000 : 0));
      return shuffle(queued.slice(0, n)).map(buildCollocationItem);
    },
    [words, practicableCollocations, rows, wordExercises, settings]
  );

  const startCollection = useCallback(
    async (collectionId: string, level: Level) => {
      if (!supabase) return;
      const ids = await collectionWordIds(supabase, collectionId);
      if (ids.size === 0) {
        setPoolError("Bộ sưu tập này chưa có từ nào — bấm 🔖 ở Home để thêm từ vào.");
        setPhase("menu");
        return;
      }
      beginSession(buildPool(level, ids), level);
    },
    [supabase, beginSession, buildPool]
  );

  /** Người học bấm chọn dạng bài (Level) từ menu. */
  const start = useCallback(
    async (level: Level) => {
      setPoolError(null);
      if (scope.type === "word") {
        const target = words.find((w) => w.id === scope.id);
        if (!target) {
          setPoolError("Không tìm thấy từ này.");
          return;
        }
        // Phạm vi 1 từ: Level 1 luyện chính từ đó, Level 2 luyện các cụm chứa nó
        if (level === 1) beginSession([buildWordItem(target, wordExercises)], 1);
        else beginSession(buildPool(2, new Set([target.id])), 2);
        return;
      }
      if (scope.type === "collocation") {
        const target = collocations.find((c) => c.id === scope.id);
        if (!target) {
          setPoolError("Không tìm thấy cụm từ này.");
          return;
        }
        if (level === 2) beginSession([buildCollocationItem(target)], 2);
        else {
          // Level 1 trong phạm vi 1 cụm = luyện các từ đơn cấu thành
          const parts = words.filter((w) => target.word_ids.includes(w.id));
          beginSession(
            parts.map((w) => buildWordItem(w, wordExercises)),
            1
          );
        }
        return;
      }
      if (scope.type === "collection") {
        startCollection(scope.id, level);
        return;
      }
      if (settings?.mode === "collection") {
        setPendingLevel(level);
        setPhase("pick");
        if (collections === null && supabase) setCollections(await fetchCollections(supabase));
      } else {
        beginSession(buildPool(level), level);
      }
    },
    [
      scope,
      words,
      collocations,
      wordExercises,
      settings,
      collections,
      supabase,
      beginSession,
      buildPool,
      startCollection,
    ]
  );

  const item = items[idx];
  const exercise = item?.exercises[exIndex];

  const saveSession = async (target: SessionItem, res: SessionResult) => {
    if (!supabase || !userId) return;
    const existing =
      rows.find((r) => r.item_type === target.itemType && r.item_id === target.id) ??
      emptyRow(userId, target.itemType, target.id);
    const updated = applySession(existing, res);
    setRows((prev) => [
      ...prev.filter((r) => !(r.item_type === target.itemType && r.item_id === target.id)),
      updated,
    ]);
    await supabase.from("progress").upsert(updated, { onConflict: "user_id,item_type,item_id" });
  };

  const check = (given?: string) => {
    if (!exercise || result) return;
    const answer = given ?? input;
    if (exercise.type === "multiple_choice" && given !== undefined) setInput(given);
    const r = grade(answer, exercise.answer, exercise.alt);
    setResult(r);
    const key = r === "correct" ? "correct" : r === "near" ? "near" : "wrong";
    setTally((t) => ({ ...t, [key]: t[key] + 1 }));
  };

  const next = async () => {
    if (!item) return;
    if (exIndex + 1 < item.exercises.length) {
      setExIndex(exIndex + 1);
      setInput("");
      setResult(null);
      return;
    }
    await saveSession(item, tally);
    setLog((prev) => [...prev, { title: item.title, ...tally }]);
    if (idx + 1 < items.length) {
      setIdx(idx + 1);
      resetItemState();
      activate(items[idx + 1], rows);
    } else {
      setPhase("summary");
    }
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
              ? `Phiên ${settings.quantity} mục · ${
                  settings.mode === "free" ? "random toàn kho theo lịch ôn" : "theo bộ sưu tập"
                }`
              : "Luyện trong phạm vi đang chọn"}
          </p>
          {settings.mode === "collection" && scope.type === "all" && (
            <p className="mt-2 text-xs text-amber-600">
              Hãy nhớ tạo list học tập trước khi luyện tập nhé 📚
            </p>
          )}
          <div className="mt-3 grid grid-cols-1 gap-2">
            <button
              onClick={() => start(1)}
              className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white active:bg-blue-700"
            >
              Level 1 — Từ đơn
            </button>
            <button
              onClick={() => start(2)}
              className="w-full rounded-xl border-2 border-blue-600 py-3 font-semibold text-blue-700 active:bg-blue-50"
            >
              Level 2 — Collocation
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Học thuộc từ đơn ở Level 1 (mastery ≥ 3) để các collocation ghép từ chúng được ưu tiên ở
            Level 2.
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
        <h2 className="font-semibold text-gray-900">Chọn bộ sưu tập · Level {pendingLevel}</h2>
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
              onClick={() => startCollection(c.id, pendingLevel)}
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

  // ---- Tổng kết phiên ----
  if (phase === "summary") {
    const totals = log.reduce(
      (s, l) => ({ correct: s.correct + l.correct, near: s.near + l.near, wrong: s.wrong + l.wrong }),
      { correct: 0, near: 0, wrong: 0 }
    );
    const score = pct(totals);
    return (
      <div className="px-4 py-6 text-center space-y-4">
        <p className="text-5xl">{score >= 80 ? "🎉" : score >= 50 ? "💪" : "📖"}</p>
        <p className="text-xl font-bold">
          Level {sessionLevel} · {log.length} mục — {score}%
        </p>
        <p className="text-sm text-gray-500">
          ✅ {totals.correct} đúng · 🟡 {totals.near} gần đúng · ❌ {totals.wrong} sai
        </p>
        <ul className="space-y-1.5 text-left">
          {[...log]
            .sort((a, b) => pct(a) - pct(b))
            .map((l, i) => (
              <li key={i} className="flex items-center rounded-xl border border-gray-100 px-3 py-2">
                <span className="flex-1 font-semibold text-gray-900">{l.title}</span>
                <span
                  className={`text-sm font-semibold ${
                    pct(l) >= 80 ? "text-green-600" : pct(l) >= 50 ? "text-yellow-600" : "text-red-500"
                  }`}
                >
                  {pct(l)}%
                </span>
              </li>
            ))}
        </ul>
        <div className="flex gap-2">
          <Link
            href="/"
            className="flex-1 rounded-2xl border border-gray-300 py-3 font-semibold text-gray-700"
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

  if (!item || !exercise)
    return <p className="p-6 text-center text-gray-400">Đang chuẩn bị bài luyện…</p>;

  const isLastItem = idx + 1 >= items.length;
  const isLastExercise = exIndex + 1 >= item.exercises.length;

  return (
    <div className="px-4 pb-8">
      {/* Mục đang luyện + tiến độ phiên */}
      <div className="pt-4 pb-2 text-center">
        <p className="text-xs font-semibold text-gray-400">
          Level {sessionLevel} · Mục {idx + 1}/{items.length}
        </p>
        <p className="mt-1 text-2xl font-bold text-gray-900">
          {result ? item.title : "• • •"}
        </p>
        <p className="text-sm text-gray-500">{item.subtitle}</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white">
            {item.itemType === "word" ? "Từ đơn" : "Collocation"}
          </span>
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="Ôn lý thuyết"
            className="rounded-full bg-gray-100 px-3 py-1.5 text-sm"
          >
            📖 Lý thuyết
          </button>
          {item.word && (
            <button
              onClick={() => setFeedbackOpen(true)}
              aria-label="Góp ý"
              className="rounded-full bg-gray-100 px-3 py-1.5 text-sm"
            >
              💬 Góp ý
            </button>
          )}
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold uppercase text-gray-400">
          Câu {exIndex + 1}/{item.exercises.length}
        </p>

        {/* Đề bài */}
        {exercise.before || exercise.after ? (
          <p className="mt-3 text-lg leading-relaxed text-gray-900">
            {exercise.before}
            <span className="inline-block min-w-24 border-b-2 border-blue-400 text-center font-semibold text-blue-700">
              {result ? input || "—" : "______"}
            </span>
            {exercise.after}
            {exercise.pattern && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                {exercise.pattern}
              </span>
            )}
          </p>
        ) : null}
        {exercise.prompt && (
          <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2.5 text-gray-800">{exercise.prompt}</p>
        )}

        {/* Trả lời */}
        {exercise.type === "multiple_choice" ? (
          <div className="mt-4 space-y-2">
            {exercise.options.map((opt) => {
              const chosen = input === opt;
              const isAnswer = opt === exercise.answer;
              const style = !result
                ? "border-gray-200 active:bg-blue-50"
                : isAnswer
                  ? "border-green-500 bg-green-50"
                  : chosen
                    ? "border-red-500 bg-red-50"
                    : "border-gray-200 opacity-60";
              return (
                <button
                  key={opt}
                  onClick={() => check(opt)}
                  disabled={!!result}
                  className={`w-full rounded-xl border-2 px-4 py-3 text-left text-base ${style}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            value={input}
            disabled={!!result}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check()}
            placeholder="Nhập câu trả lời…"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={`mt-4 w-full rounded-xl border-2 px-4 py-3 text-lg outline-none ${
              result ? RESULT_STYLE[result] : "border-gray-200 focus:border-blue-500"
            }`}
          />
        )}

        {!result && exercise.type === "fill_in" && (
          <button
            onClick={() => check()}
            className="mt-2 w-full rounded-2xl bg-blue-600 py-3.5 text-lg font-semibold text-white"
          >
            Kiểm tra
          </button>
        )}

        {result && (
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
              <p className="font-semibold">
                {result === "correct"
                  ? "✅ Chính xác!"
                  : result === "near"
                    ? `🟡 Gần đúng — chỉ lệch chút ít. Đáp án: ${exercise.answer}`
                    : `❌ Đáp án: ${exercise.answer}`}
              </p>
              {exercise.explain_vi && <p className="mt-1">{exercise.explain_vi}</p>}
            </div>
            <button
              onClick={next}
              className="w-full rounded-2xl bg-blue-600 py-3.5 text-lg font-semibold text-white"
            >
              {!isLastExercise ? "Câu tiếp theo" : isLastItem ? "Tổng kết phiên" : "Mục tiếp theo →"}
            </button>
          </div>
        )}
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        {item.word && <WordDetail word={item.word} />}
        {item.collocation && <CollocationDetail collocation={item.collocation} />}
      </BottomSheet>
      {userId && item.word && feedbackOpen && (
        <FeedbackSheet
          wordId={item.word.id}
          userId={userId}
          onClose={() => setFeedbackOpen(false)}
        />
      )}
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
