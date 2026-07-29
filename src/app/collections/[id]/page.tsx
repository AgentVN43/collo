"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import BottomSheet from "@/components/BottomSheet";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { fetchWords } from "@/lib/words";
import { collectionWordIds, toggleWordInCollection } from "@/lib/collections";
import type { Collection, Word } from "@/lib/types";

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { userId, loading: authLoading } = useSession();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const supabase = getSupabase();

  useEffect(() => {
    if (!supabase || !userId || !id) {
      if (!authLoading) setLoading(false);
      return;
    }
    Promise.all([
      supabase.from("collections").select("*").eq("id", id).maybeSingle(),
      collectionWordIds(supabase, id),
      fetchWords(supabase),
    ]).then(([colRes, wordIds, words]) => {
      setCollection((colRes.data as Collection) ?? null);
      setIds(wordIds);
      setAllWords(words);
      setLoading(false);
    });
  }, [supabase, userId, id, authLoading]);

  const wordsInCollection = useMemo(
    () =>
      allWords
        .filter((w) => ids.has(w.id))
        .sort((a, b) => a.word.localeCompare(b.word, "fr")),
    [allWords, ids]
  );

  // Kết quả tìm kiếm trong sheet thêm từ
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = q
      ? allWords.filter(
          (w) =>
            w.word.toLowerCase().includes(q) ||
            w.meaning_vi.toLowerCase().includes(q) ||
            w.meaning_en.toLowerCase().includes(q)
        )
      : allWords;
    return [...pool].sort((a, b) => a.word.localeCompare(b.word, "fr")).slice(0, 30);
  }, [allWords, search]);

  const toggle = async (wordId: string) => {
    if (!supabase || !id) return;
    const add = !ids.has(wordId);
    const next = new Set(ids);
    if (add) next.add(wordId);
    else next.delete(wordId);
    setIds(next);
    await toggleWordInCollection(supabase, id, wordId, add);
  };

  return (
    <div>
      <TopBar title={collection?.name ?? "Bộ sưu tập"} back />
      {authLoading || loading ? (
        <p className="p-6 text-center text-gray-400">Đang tải…</p>
      ) : !userId || !collection ? (
        <p className="p-6 text-center text-gray-500">Không tìm thấy bộ sưu tập.</p>
      ) : (
        <>
          <div className="flex gap-2 px-4 pt-4">
            {wordsInCollection.length > 0 && (
              <Link
                href={`/practice?collection=${collection.id}`}
                className="flex-1 rounded-2xl bg-blue-600 py-3 text-center font-semibold text-white"
              >
                Luyện bộ này ({wordsInCollection.length} từ)
              </Link>
            )}
            <button
              onClick={() => {
                setSearch("");
                setAddOpen(true);
              }}
              className={`rounded-2xl border-2 border-dashed border-gray-300 py-3 font-semibold text-gray-600 ${
                wordsInCollection.length > 0 ? "px-4" : "flex-1"
              }`}
            >
              ＋ Thêm từ
            </button>
          </div>

          {wordsInCollection.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">
              Bộ này chưa có từ nào — bấm ＋ Thêm từ, hoặc 🔖 ở Home.
            </p>
          ) : (
            <ul className="mt-2">
              {wordsInCollection.map((w) => (
                <li key={w.id} className="flex items-center border-b border-gray-100 px-4 py-3">
                  <Link href={`/word/${w.id}`} className="flex-1 min-w-0">
                    <span className="text-lg font-bold text-gray-900">{w.word}</span>
                    <p className="truncate text-sm text-gray-700">{w.meaning_vi}</p>
                    <p className="truncate text-xs text-gray-400">{w.meaning_en}</p>
                  </Link>
                  <button
                    onClick={() => toggle(w.id)}
                    aria-label="Bỏ khỏi bộ sưu tập"
                    className="p-2 text-lg text-gray-400"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Bottom sheet: tìm và thêm từ vào bộ đang mở */}
          <BottomSheet open={addOpen} onClose={() => setAddOpen(false)}>
            <div className="px-4 pb-8">
              <div className="sticky top-0 bg-white py-3">
                <h2 className="mb-2 font-semibold text-gray-900">
                  Thêm từ vào “{collection.name}”
                </h2>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nhập từ hoặc nghĩa để tìm…"
                  autoFocus
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-blue-500"
                />
              </div>
              {results.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">
                  Không tìm thấy từ nào khớp “{search}”.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {results.map((w) => {
                    const added = ids.has(w.id);
                    return (
                      <li key={w.id}>
                        <button
                          onClick={() => toggle(w.id)}
                          className="flex w-full items-center gap-3 py-3 text-left"
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
                              added
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-gray-300 text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block truncate font-semibold text-gray-900">
                              {w.word}
                            </span>
                            <span className="block truncate text-sm text-gray-500">
                              {w.meaning_vi}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </BottomSheet>
        </>
      )}
    </div>
  );
}
