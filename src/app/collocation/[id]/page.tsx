"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import CollocationDetail from "@/components/CollocationDetail";
import { getSupabase } from "@/lib/supabase";
import { fetchCollocation, fetchCollocations, siblingsOf } from "@/lib/collocations";
import { fetchWords } from "@/lib/words";
import type { Collocation, Word } from "@/lib/types";

export default function CollocationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [collocation, setCollocation] = useState<Collocation | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [siblings, setSiblings] = useState<Collocation[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  useEffect(() => {
    if (!supabase || !id) return;
    Promise.all([
      fetchCollocation(supabase, id),
      fetchWords(supabase),
      fetchCollocations(supabase),
    ]).then(([c, allWords, allCollocations]) => {
      setCollocation(c);
      setWords(c ? allWords.filter((w) => c.word_ids.includes(w.id)) : []);
      setSiblings(c ? siblingsOf(allCollocations, c) : []);
      setLoading(false);
    });
  }, [supabase, id]);

  return (
    <div>
      <TopBar title={collocation?.chunk ?? "Chi tiết cụm từ"} back />
      {loading && <p className="p-6 text-center text-gray-400">Đang tải…</p>}
      {!loading && !collocation && (
        <p className="p-6 text-center text-gray-500">Không tìm thấy cụm từ này.</p>
      )}
      {collocation && (
        <>
          <CollocationDetail
            collocation={collocation}
            words={words}
            siblings={siblings}
          />
          {/* CTA nối sang Practice (luyện chính cụm này) */}
          <div className="fixed bottom-16 inset-x-0 z-30">
            <div className="mx-auto max-w-md px-4 pb-3">
              <button
                onClick={() => router.push(`/practice?collocation=${collocation.id}`)}
                className="w-full rounded-2xl bg-blue-600 py-3.5 text-white font-semibold text-lg shadow-lg active:bg-blue-700"
              >
                Luyện cụm này
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
