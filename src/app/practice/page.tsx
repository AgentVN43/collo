"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import AccentBar from "@/components/AccentBar";
import BottomSheet from "@/components/BottomSheet";
import WordDetail from "@/components/WordDetail";
import FeedbackSheet from "@/components/FeedbackSheet";
import { getSupabase } from "@/lib/supabase";
import { fetchWords } from "@/lib/words";
import { useSession } from "@/lib/useSession";
import { grade, joinPronoun, pronounLabel, type GradeResult } from "@/lib/french";
import { applySession, buildQueue, emptyRow, type SessionResult } from "@/lib/progress";
import { getEnabledTenses, getPracticeSettings, type PracticeSettings } from "@/lib/settings";
import { collectionWordIds, fetchCollections, type CollectionWithCount } from "@/lib/collections";
import type { ClozeItem, ProgressRow, TenseKey, Word } from "@/lib/types";
import { PRONOUN_KEYS, TENSE_KEYS, TENSE_LABELS } from "@/lib/types";

type Phase = "menu" | "pick" | "l1" | "l1done" | "l2" | "summary";
type Level = 1 | 2;
type Scope = { type: "all" } | { type: "word"; id: string } | { type: "collection"; id: string };

interface WordLog {
  word: Word;
  tense: TenseKey;
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

function PracticeSession() {
  const params = useSearchParams();
  const wordParam = params.get("word");
  const collectionParam = params.get("collection");
  const { userId, loading: authLoading } = useSession();
  const supabase = getSupabase();

  // Dữ liệu nền
  const [words, setWords] = useState<Word[]>([]);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [enabledTenses, setEnabledTenses] = useState<TenseKey[] | null>(null);
  const [settings, setSettings] = useState<PracticeSettings | null>(null);

  // Phiên luyện — Level 1 và Level 2 là hai dạng bài độc lập, chọn từ màn menu
  const [phase, setPhase] = useState<Phase>("menu");
  const [sessionLevel, setSessionLevel] = useState<Level>(1);
  const [scope, setScope] = useState<Scope>({ type: "all" });
  const [pendingLevel, setPendingLevel] = useState<Level>(1);
  const [sessionWords, setSessionWords] = useState<Word[]>([]);
  const [idx, setIdx] = useState(0);
  const [log, setLog] = useState<WordLog[]>([]);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [collections, setCollections] = useState<CollectionWithCount[] | null>(null);

  // Từ đang luyện
  const [word, setWord] = useState<Word | null>(null);
  const [tense, setTense] = useState<TenseKey>("present");
  const [wordTally, setWordTally] = useState<SessionResult>({ correct: 0, near: 0, wrong: 0 });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Level 1
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [l1Results, setL1Results] = useState<Record<string, GradeResult> | null>(null);

  // Level 2
  const [clozeItems, setClozeItems] = useState<ClozeItem[]>([]);
  const [clozeIndex, setClozeIndex] = useState(0);
  const [clozeInput, setClozeInput] = useState("");
  const [clozeResult, setClozeResult] = useState<GradeResult | null>(null);
  const [l2Session, setL2Session] = useState<SessionResult>({ correct: 0, near: 0, wrong: 0 });

  const activeInput = useRef<HTMLInputElement | null>(null);
  const l1Inputs = useRef<(HTMLInputElement | null)[]>([]);
  const deepLinked = useRef(false);

  useEffect(() => {
    setEnabledTenses(getEnabledTenses());
    setSettings(getPracticeSettings());
  }, []);

  useEffect(() => {
    if (!supabase || !userId) return;
    Promise.all([fetchWords(supabase), supabase.from("progress").select("*")]).then(([w, p]) => {
      setWords(w);
      setRows((p.data as ProgressRow[]) ?? []);
      setLoaded(true);
    });
  }, [supabase, userId]);

  // Deep link chỉ đặt PHẠM VI (từ / bộ sưu tập) — người học vẫn tự chọn Level ở menu
  useEffect(() => {
    if (deepLinked.current) return;
    if (wordParam) {
      deepLinked.current = true;
      setScope({ type: "word", id: wordParam });
    } else if (collectionParam) {
      deepLinked.current = true;
      setScope({ type: "collection", id: collectionParam });
    }
  }, [wordParam, collectionParam]);

  /** Thì luyện được: bật trong Settings ∩ có content; Level 2 đòi hỏi có câu cloze. */
  const availableTenses = useCallback(
    (w: Word, level: Level) =>
      TENSE_KEYS.filter((t) => {
        const d = w.conjugations[t];
        if (!d || !(enabledTenses?.includes(t) ?? true)) return false;
        return level === 1 || (d.cloze?.length ?? 0) > 0;
      }),
    [enabledTenses]
  );

  /** Bắt đầu một từ: random thì + kích hoạt dòng progress đúng level của phiên. */
  const startWord = useCallback(
    async (target: Word, allRows: ProgressRow[], level: Level) => {
      if (!supabase || !userId) return;
      const available = availableTenses(target, level);
      const t = available[Math.floor(Math.random() * available.length)];
      const tData = target.conjugations[t];
      setWord(target);
      setTense(t);
      setAnswers({});
      setL1Results(null);
      setClozeIndex(0);
      setClozeInput("");
      setClozeResult(null);
      setL2Session({ correct: 0, near: 0, wrong: 0 });
      setWordTally({ correct: 0, near: 0, wrong: 0 });
      if (level === 1) {
        setPhase("l1");
      } else {
        setClozeItems(shuffle(tData?.cloze ?? []));
        setPhase("l2");
      }
      const exists = allRows.some(
        (r) => r.word_id === target.id && r.tense === t && r.level === level
      );
      if (!exists) {
        const row = emptyRow(userId, target.id, t, level);
        setRows((prev) => [...prev, row]);
        await supabase
          .from("progress")
          .upsert(row, { onConflict: "user_id,word_id,tense,level", ignoreDuplicates: true });
      }
    },
    [supabase, userId, availableTenses]
  );

  const beginSession = useCallback(
    (list: Word[], level: Level) => {
      if (list.length === 0) {
        setPoolError(
          level === 2
            ? "Không có từ nào có bài tập câu (cloze) trong phạm vi này — kiểm tra Settings hoặc chọn Level 1."
            : "Không có từ nào luyện được trong phạm vi này — kiểm tra Settings → Tense to Practice."
        );
        setPhase("menu");
        return;
      }
      setPoolError(null);
      setSessionLevel(level);
      setSessionWords(list);
      setIdx(0);
      setLog([]);
      startWord(list[0], rows, level);
    },
    [rows, startWord]
  );

  /** Chọn N từ theo hàng đợi ưu tiên rồi xáo thứ tự hiển thị. */
  const buildPool = useCallback(
    (scopeWords: Word[], n: number, level: Level) => {
      const practicable = scopeWords.filter((w) => availableTenses(w, level).length > 0);
      return shuffle(buildQueue(practicable, rows).slice(0, n));
    },
    [availableTenses, rows]
  );

  const startCollection = useCallback(
    async (collectionId: string, level: Level) => {
      if (!supabase) return;
      const ids = await collectionWordIds(supabase, collectionId);
      const scopeWords = words.filter((w) => ids.has(w.id));
      if (scopeWords.length === 0) {
        setPoolError("Bộ sưu tập này chưa có từ nào — bấm 🔖 ở Home để thêm từ vào.");
        setPhase("menu");
        return;
      }
      beginSession(buildPool(scopeWords, settings?.quantity ?? 5, level), level);
    },
    [supabase, words, beginSession, buildPool, settings]
  );

  /** Người học bấm chọn dạng bài (Level) từ menu. */
  const start = useCallback(
    async (level: Level) => {
      setPoolError(null);
      if (scope.type === "word") {
        const target = words.find((w) => w.id === scope.id);
        if (target) beginSession([target], level);
        else setPoolError("Không tìm thấy từ này.");
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
        beginSession(buildPool(words, settings?.quantity ?? 5, level), level);
      }
    },
    [scope, words, settings, collections, supabase, beginSession, buildPool, startCollection]
  );

  const tenseData = word?.conjugations[tense];

  const insertChar = (ch: string) => {
    const el = activeInput.current;
    if (!el) return;
    const key = el.dataset.field;
    if (!key) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + ch + el.value.slice(end);
    if (key === "cloze") setClozeInput(next);
    else setAnswers((a) => ({ ...a, [key]: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 1, start + 1);
    });
  };

  const saveSession = async (level: number, result: SessionResult) => {
    if (!supabase || !userId || !word) return;
    const existing =
      rows.find((r) => r.word_id === word.id && r.tense === tense && r.level === level) ??
      emptyRow(userId, word.id, tense, level);
    const updated = applySession(existing, result);
    setRows((prev) => [
      ...prev.filter((r) => !(r.word_id === word.id && r.tense === tense && r.level === level)),
      updated,
    ]);
    await supabase.from("progress").upsert(updated, { onConflict: "user_id,word_id,tense,level" });
  };

  /** Xong một từ → ghi log, tự chuyển từ kế hoặc sang tổng kết phiên. */
  const advance = (tally: SessionResult) => {
    if (!word) return;
    setLog((prev) => [...prev, { word, tense, ...tally }]);
    if (idx + 1 < sessionWords.length) {
      setIdx(idx + 1);
      startWord(sessionWords[idx + 1], rows, sessionLevel);
    } else {
      setPhase("summary");
    }
  };

  // ===== Level 1 =====
  const checkL1 = async () => {
    if (!word || !tenseData || phase !== "l1") return;
    const results: Record<string, GradeResult> = {};
    const session: SessionResult = { correct: 0, near: 0, wrong: 0 };
    for (const p of PRONOUN_KEYS) {
      const r = grade(answers[p] ?? "", tenseData.forms[p], tenseData.alt?.[p] ?? []);
      results[p] = r;
      session[r === "correct" ? "correct" : r === "near" ? "near" : "wrong"]++;
    }
    setL1Results(results);
    setWordTally(session);
    setPhase("l1done");
    await saveSession(1, session);
  };

  // ===== Level 2 =====
  const checkCloze = () => {
    const item = clozeItems[clozeIndex];
    if (!item || clozeResult) return;
    const r = grade(clozeInput, item.answer, item.alt ?? []);
    setClozeResult(r);
    const key = r === "correct" ? "correct" : r === "near" ? "near" : "wrong";
    setL2Session((s) => ({ ...s, [key]: s[key] + 1 }));
    setWordTally((t) => ({ ...t, [key]: t[key] + 1 }));
  };

  const nextCloze = async () => {
    if (clozeIndex + 1 < clozeItems.length) {
      setClozeIndex(clozeIndex + 1);
      setClozeInput("");
      setClozeResult(null);
    } else {
      await saveSession(2, l2Session);
      advance(wordTally);
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

  // ---- Màn chọn bài: mỗi Level là một dạng bài độc lập ----
  if (phase === "menu") {
    const scopeWord = scope.type === "word" ? words.find((w) => w.id === scope.id) : null;
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
              Phạm vi: {scopeWord ? <b>{scopeWord.word}</b> : "bộ sưu tập đã chọn"}
            </span>
            <button onClick={() => setScope({ type: "all" })} className="ml-2 text-blue-600">
              ✕ Bỏ
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 p-4">
          <h2 className="text-lg font-bold text-gray-900">✍️ Chia động từ</h2>
          <p className="mt-1 text-sm text-gray-500">
            {scope.type === "word"
              ? "Luyện 1 từ đang chọn"
              : `Phiên ${settings.quantity} từ · ${
                  settings.mode === "free" ? "random toàn kho theo lịch ôn" : "theo bộ sưu tập"
                }`}{" "}
            · thì xáo trộn theo Settings
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
              Level 1 — Chia theo đại từ
            </button>
            <button
              onClick={() => start(2)}
              className="w-full rounded-xl border-2 border-blue-600 py-3 font-semibold text-blue-700 active:bg-blue-50"
            >
              Level 2 — Chia trong câu
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4 opacity-50">
          <h2 className="text-lg font-bold text-gray-900">🚻 Giới tính của danh từ</h2>
          <p className="mt-1 text-sm text-gray-500">Sắp ra mắt</p>
        </div>
        <p className="text-center text-xs text-gray-400">
          Đổi chế độ và số từ mỗi phiên trong{" "}
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
        <h2 className="font-semibold text-gray-900">
          Chọn bộ sưu tập · Level {pendingLevel}
        </h2>
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
          Level {sessionLevel} · {log.length} từ — {score}%
        </p>
        <p className="text-sm text-gray-500">
          ✅ {totals.correct} đúng · 🟡 {totals.near} sai dấu · ❌ {totals.wrong} sai
        </p>
        <ul className="space-y-1.5 text-left">
          {[...log]
            .sort((a, b) => pct(a) - pct(b))
            .map((l, i) => (
              <li key={i} className="flex items-center rounded-xl border border-gray-100 px-3 py-2">
                <span className="flex-1">
                  <span className="font-semibold text-gray-900">{l.word.word}</span>
                  <span className="ml-2 text-xs text-gray-400">{TENSE_LABELS[l.tense]}</span>
                </span>
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

  if (!word || !tenseData)
    return <p className="p-6 text-center text-gray-400">Đang chuẩn bị bài luyện…</p>;

  const l1Score = l1Results
    ? pct({
        correct: PRONOUN_KEYS.filter((p) => l1Results[p] === "correct").length,
        near: PRONOUN_KEYS.filter((p) => l1Results[p] === "near").length,
        wrong: PRONOUN_KEYS.filter((p) => l1Results[p] === "wrong").length,
      })
    : 0;
  const isLastWord = idx + 1 >= sessionWords.length;

  return (
    <div className="px-4 pb-8">
      {/* Word + tiến độ phiên + thì đang luyện */}
      <div className="pt-4 pb-2 text-center">
        <p className="text-xs font-semibold text-gray-400">
          Level {sessionLevel} · Từ {idx + 1}/{sessionWords.length}
        </p>
        <p className="mt-1 text-3xl font-bold text-gray-900">{word.word}</p>
        <p className="text-sm text-gray-500">{word.meaning_vi}</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white">
            {TENSE_LABELS[tense]}
          </span>
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="Ôn lý thuyết"
            className="rounded-full bg-gray-100 px-3 py-1.5 text-sm"
          >
            📖 Lý thuyết
          </button>
          <button
            onClick={() => setFeedbackOpen(true)}
            aria-label="Góp ý"
            className="rounded-full bg-gray-100 px-3 py-1.5 text-sm"
          >
            💬 Góp ý
          </button>
        </div>
      </div>

      {/* ===== LEVEL 1 ===== */}
      {(phase === "l1" || phase === "l1done") && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase text-gray-400 mb-2">
            Level 1 — Chia theo đại từ
          </p>
          <div className="space-y-2">
            {PRONOUN_KEYS.map((p, i) => {
              const result = l1Results?.[p];
              return (
                <div key={p} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right font-medium text-gray-700">
                    {pronounLabel(p, tenseData.forms[p])}
                  </span>
                  <input
                    ref={(el) => {
                      l1Inputs.current[i] = el;
                    }}
                    data-field={p}
                    value={answers[p] ?? ""}
                    disabled={phase === "l1done"}
                    enterKeyHint={i < PRONOUN_KEYS.length - 1 ? "next" : "go"}
                    onFocus={(e) => (activeInput.current = e.currentTarget)}
                    onChange={(e) => setAnswers((a) => ({ ...a, [p]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      if (i < PRONOUN_KEYS.length - 1) l1Inputs.current[i + 1]?.focus();
                      else checkL1();
                    }}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className={`flex-1 min-w-0 rounded-xl border-2 px-3 py-2.5 text-base outline-none ${
                      result ? RESULT_STYLE[result] : "border-gray-200 focus:border-blue-500"
                    }`}
                  />
                  {/* Copy đáp án ô trên xuống — tiện khi thì kép chỉ khác trợ động từ */}
                  <span className="w-9 shrink-0">
                    {i > 0 && phase === "l1" && (
                      <button
                        type="button"
                        aria-label="Copy ô trên xuống"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const prev = answers[PRONOUN_KEYS[i - 1]] ?? "";
                          setAnswers((a) => ({ ...a, [p]: prev }));
                          const el = l1Inputs.current[i];
                          el?.focus();
                          requestAnimationFrame(() =>
                            el?.setSelectionRange(prev.length, prev.length)
                          );
                        }}
                        className="w-9 h-9 rounded-lg border border-gray-300 bg-gray-50 text-gray-600 text-base leading-none active:bg-blue-100"
                      >
                        ⧉
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {phase === "l1" && (
            <>
              <AccentBar onInsert={insertChar} />
              <button
                onClick={checkL1}
                className="mt-2 w-full rounded-2xl bg-blue-600 py-3.5 text-white font-semibold text-lg active:bg-blue-700"
              >
                Kiểm tra
              </button>
            </>
          )}

          {phase === "l1done" && l1Results && (
            <div className="mt-4 space-y-3">
              {PRONOUN_KEYS.filter((p) => l1Results[p] !== "correct").length > 0 && (
                <div className="rounded-xl bg-gray-50 p-3 space-y-1 text-sm">
                  {PRONOUN_KEYS.filter((p) => l1Results[p] !== "correct").map((p) => (
                    <p key={p}>
                      {l1Results[p] === "near" ? "🟡" : "🔴"} Đáp án:{" "}
                      <span className="font-semibold">{joinPronoun(p, tenseData.forms[p])}</span>
                      {l1Results[p] === "near" && (
                        <span className="text-gray-500"> — chỉ sai dấu, chú ý accent nhé.</span>
                      )}
                    </p>
                  ))}
                </div>
              )}
              <p className="text-center font-semibold">
                Kết quả: {l1Score}% {l1Score >= 80 ? "🎉" : ""}
              </p>
              <button
                onClick={() => advance(wordTally)}
                className="w-full rounded-2xl bg-blue-600 py-3 font-semibold text-white"
              >
                {isLastWord ? "Tổng kết phiên" : "Từ tiếp theo →"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== LEVEL 2 ===== */}
      {phase === "l2" && clozeItems[clozeIndex] && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase text-gray-400 mb-1">
            Level 2 — Chia trong câu · Câu {clozeIndex + 1}/{clozeItems.length}
          </p>
          <p className="mt-3 text-lg leading-relaxed text-gray-900">
            {clozeItems[clozeIndex].before}
            <span className="inline-block min-w-24 border-b-2 border-blue-400 text-center font-semibold text-blue-700">
              {clozeResult ? clozeInput || "—" : "______"}
            </span>
            {clozeItems[clozeIndex].after}
            <span className="ml-2 text-sm text-gray-400">({clozeItems[clozeIndex].hint})</span>
          </p>
          <input
            data-field="cloze"
            value={clozeInput}
            disabled={!!clozeResult}
            onFocus={(e) => (activeInput.current = e.currentTarget)}
            onChange={(e) => setClozeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && checkCloze()}
            placeholder="Chia động từ…"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={`mt-4 w-full rounded-xl border-2 px-4 py-3 text-lg outline-none ${
              clozeResult ? RESULT_STYLE[clozeResult] : "border-gray-200 focus:border-blue-500"
            }`}
          />
          {!clozeResult && (
            <>
              <AccentBar onInsert={insertChar} />
              <button
                onClick={checkCloze}
                className="mt-2 w-full rounded-2xl bg-blue-600 py-3.5 text-white font-semibold text-lg"
              >
                Kiểm tra
              </button>
            </>
          )}
          {clozeResult && (
            <div className="mt-3 space-y-3">
              <div
                className={`rounded-xl p-3 text-sm ${
                  clozeResult === "correct"
                    ? "bg-green-50 text-green-800"
                    : clozeResult === "near"
                      ? "bg-yellow-50 text-yellow-800"
                      : "bg-red-50 text-red-800"
                }`}
              >
                <p className="font-semibold">
                  {clozeResult === "correct"
                    ? "✅ Chính xác!"
                    : clozeResult === "near"
                      ? `🟡 Gần đúng — chỉ sai dấu. Đáp án: ${clozeItems[clozeIndex].answer}`
                      : `❌ Đáp án: ${clozeItems[clozeIndex].answer}`}
                </p>
                <p className="mt-1">{clozeItems[clozeIndex].explain_vi}</p>
              </div>
              <button
                onClick={nextCloze}
                className="w-full rounded-2xl bg-blue-600 py-3.5 text-white font-semibold text-lg"
              >
                {clozeIndex + 1 < clozeItems.length
                  ? "Câu tiếp theo"
                  : isLastWord
                    ? "Tổng kết phiên"
                    : "Từ tiếp theo →"}
              </button>
            </div>
          )}
        </div>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        {word && <WordDetail word={word} />}
      </BottomSheet>
      {userId && word && feedbackOpen && (
        <FeedbackSheet
          wordId={word.id}
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
