"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { wordDot } from "@/lib/progress";
import { fetchWords } from "@/lib/words";
import { savedWordIds } from "@/lib/collections";
import CollectionSheet from "@/components/CollectionSheet";
import type { ProgressRow, Word } from "@/lib/types";

const DOT_CLASS = {
  gray: "bg-gray-300",
  yellow: "bg-yellow-400",
  green: "bg-green-500",
} as const;

export default function HomePage() {
  const router = useRouter();
  const { userId, loading: authLoading } = useSession();
  const [words, setWords] = useState<Word[]>([]);
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
    fetchWords(supabase).then((list) => {
      setWords(list);
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

  // Tap 🔖 → mở bottom sheet chọn bộ sưu tập (không toggle trực tiếp nữa)
  const openCollectionSheet = (wordId: string) => {
    if (!userId) {
      router.push("/login?next=/");
      return;
    }
    setSheetWordId(wordId);
  };

  // Section theo chủ đề, A→Z bên trong mỗi section
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? words.filter(
          (w) =>
            w.word.toLowerCase().includes(q) ||
            w.meaning_vi.toLowerCase().includes(q) ||
            w.meaning_en.toLowerCase().includes(q)
        )
      : words;
    const byTopic = new Map<string, { order: number; list: Word[] }>();
    for (const w of filtered) {
      const entry = byTopic.get(w.topic) ?? { order: w.topicOrder, list: [] };
      entry.list.push(w);
      byTopic.set(w.topic, entry);
    }
    // section theo sort_order của topic content, A→Z bên trong
    return [...byTopic.entries()]
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([topic, { list }]) => ({
        topic,
        list: list.sort((a, b) => a.word.localeCompare(b.word, "fr")),
      }));
  }, [words, search]);

  return (
    <div>
      <TopBar title="Folask" settings />
      <div className="px-4 py-3 sticky top-12 z-30 bg-white border-b border-gray-100">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm từ hoặc nghĩa…"
          className="w-full rounded-xl border border-gray-300 px-4 py-2 text-base outline-none focus:border-blue-500"
        />
      </div>

      {!supabase && (
        <p className="m-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          Chưa cấu hình Supabase. Copy <code>.env.local.example</code> thành <code>.env.local</code>,
          điền URL + anon key rồi khởi động lại server.
        </p>
      )}
      {loading && <p className="p-6 text-center text-gray-400">Đang tải…</p>}
      {!loading && supabase && words.length === 0 && (
        <p className="m-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
          Chưa có từ vựng. Chạy <code>npm run seed</code> để nạp 13 động từ mẫu.
        </p>
      )}

      {sections.map(({ topic, list }) => (
        <section key={topic}>
          <h2 className="sticky top-[6.5rem] z-20 bg-gray-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-y border-gray-100">
            {topic}
          </h2>
          <ul>
            {list.map((w) => {
              const dot = authLoading || !userId ? "gray" : wordDot(w, progress);
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
        </section>
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
