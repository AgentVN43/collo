"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { masteryDot } from "@/lib/progress";
import { fetchWords } from "@/lib/words";
import { fetchCollocations } from "@/lib/collocations";
import { savedWordIds } from "@/lib/collections";
import CollectionSheet from "@/components/CollectionSheet";
import { RegisterBadge } from "@/components/CollocationDetail";
import type { Collocation, ProgressRow, Word } from "@/lib/types";

const DOT_CLASS = {
  gray: "bg-gray-300",
  yellow: "bg-yellow-400",
  green: "bg-green-500",
} as const;

type Tab = "words" | "collocations";

export default function HomePage() {
  const router = useRouter();
  const { userId, loading: authLoading } = useSession();
  const [tab, setTab] = useState<Tab>("words");
  const [words, setWords] = useState<Word[]>([]);
  const [collocations, setCollocations] = useState<Collocation[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [sheetWordId, setSheetWordId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    Promise.all([fetchWords(supabase), fetchCollocations(supabase)]).then(([w, c]) => {
      setWords(w);
      setCollocations(c);
      setLoading(false);
    });
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !userId) return;
    savedWordIds(supabase).then(setSaved);
    supabase
      .from("progress")
      .select("*")
      .then(({ data }) => setProgress((data as ProgressRow[]) ?? []));
  }, [supabase, userId]);

  // Tap 🔖 → mở bottom sheet chọn bộ sưu tập
  const openCollectionSheet = (wordId: string) => {
    if (!userId) {
      router.push("/login?next=/");
      return;
    }
    setSheetWordId(wordId);
  };

  const q = search.trim().toLowerCase();

  // Tab từ đơn: danh sách phẳng A→Z (từ đơn không còn category)
  const wordList = useMemo(() => {
    const filtered = q
      ? words.filter(
          (w) =>
            w.word.toLowerCase().includes(q) ||
            w.meaning_vi.toLowerCase().includes(q) ||
            w.meaning_en.toLowerCase().includes(q)
        )
      : words;
    return [...filtered].sort((a, b) => a.word.localeCompare(b.word, "en"));
  }, [words, q]);

  // Tab collocation: nhóm section theo 7 loại, A→Z bên trong
  const sections = useMemo(() => {
    const filtered = q
      ? collocations.filter(
          (c) =>
            c.chunk.toLowerCase().includes(q) ||
            c.literal_meaning.toLowerCase().includes(q) ||
            (c.intent?.name_vi.toLowerCase().includes(q) ?? false)
        )
      : collocations;
    const byTopic = new Map<string, { order: number; list: Collocation[] }>();
    for (const c of filtered) {
      const entry = byTopic.get(c.topic) ?? { order: c.topicOrder, list: [] };
      entry.list.push(c);
      byTopic.set(c.topic, entry);
    }
    return [...byTopic.entries()]
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([topic, { list }]) => ({
        topic,
        list: list.sort((a, b) => a.chunk.localeCompare(b.chunk, "en")),
      }));
  }, [collocations, q]);

  const signedIn = !authLoading && !!userId;

  return (
    <div>
      <TopBar title="Folask" settings />

      {/* Tab 2 tầng học */}
      <div className="sticky top-12 z-30 bg-white border-b border-gray-100">
        <div className="flex">
          {(
            [
              ["words", `Từ đơn (${words.length})`],
              ["collocations", `Collocation (${collocations.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                tab === key ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="px-4 py-2.5">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "words" ? "Tìm từ hoặc nghĩa…" : "Tìm cụm từ…"}
            className="w-full rounded-xl border border-gray-300 px-4 py-2 text-base outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {!supabase && (
        <p className="m-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          Chưa cấu hình Supabase. Copy <code>.env.local.example</code> thành <code>.env.local</code>,
          điền URL + anon key rồi khởi động lại server.
        </p>
      )}
      {loading && <p className="p-6 text-center text-gray-400">Đang tải…</p>}

      {/* ===== TAB TỪ ĐƠN ===== */}
      {!loading &&
        supabase &&
        tab === "words" &&
        (wordList.length === 0 ? (
          <p className="m-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
            {q ? "Không tìm thấy từ nào." : "Chưa có từ vựng — import nội dung qua /api/words/import."}
          </p>
        ) : (
          <ul>
            {wordList.map((w) => {
              const dot = signedIn ? masteryDot(progress, "word", w.id) : "gray";
              return (
                <li key={w.id} className="border-b border-gray-100">
                  <div className="flex items-center px-4 py-3">
                    <Link href={`/word/${w.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[dot]}`} />
                        <span className="text-lg font-bold text-gray-900">{w.word}</span>
                        <span className="text-xs text-gray-400 italic">{w.word_type}</span>
                      </div>
                      <p className="text-sm text-gray-700 truncate">{w.meaning_vi}</p>
                      <p className="text-xs text-gray-400 truncate">{w.meaning_en}</p>
                    </Link>
                    <button
                      onClick={() => openCollectionSheet(w.id)}
                      aria-label="Lưu vào bộ sưu tập"
                      className={`p-2 text-xl ${saved.has(w.id) ? "" : "grayscale opacity-40"}`}
                    >
                      🔖
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

      {/* ===== TAB COLLOCATION ===== */}
      {!loading &&
        supabase &&
        tab === "collocations" &&
        (sections.length === 0 ? (
          <p className="m-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
            {q
              ? "Không tìm thấy cụm nào."
              : "Chưa có collocation — import nội dung qua /api/words/import."}
          </p>
        ) : (
          sections.map(({ topic, list }) => (
            <section key={topic}>
              <h2 className="sticky top-[9.5rem] z-20 border-y border-gray-100 bg-gray-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {topic}
              </h2>
              <ul>
                {list.map((c) => {
                  const dot = signedIn ? masteryDot(progress, "collocation", c.id) : "gray";
                  return (
                    <li key={c.id} className="border-b border-gray-100">
                      <Link
                        href={`/collocation/${c.id}`}
                        className="flex items-center gap-2 px-4 py-3"
                      >
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[dot]}`} />
                            <span className="truncate text-base font-bold text-gray-900">
                              {c.chunk}
                            </span>
                            <RegisterBadge register={c.register} />
                          </span>
                          <p className="truncate text-sm text-gray-700">{c.literal_meaning}</p>
                          {c.intent && (
                            <p className="truncate text-xs text-purple-600">
                              🎯 {c.intent.name_vi}
                            </p>
                          )}
                        </span>
                        <span className="text-gray-300">›</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        ))}

      {userId && (
        <CollectionSheet
          wordId={sheetWordId}
          userId={userId}
          onClose={() => setSheetWordId(null)}
          onSavedChange={(id, isSaved) => {
            const next = new Set(saved);
            if (isSaved) next.add(id);
            else next.delete(id);
            setSaved(next);
          }}
        />
      )}
    </div>
  );
}
