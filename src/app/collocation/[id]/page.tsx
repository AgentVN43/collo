"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import CollocationDetail from "@/components/CollocationDetail";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { fetchCollocation } from "@/lib/collocations";
import { fetchWords } from "@/lib/words";
import { isUnlocked } from "@/lib/progress";
import type { Collocation, ProgressRow, Word } from "@/lib/types";

export default function CollocationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useSession();
  const [collocation, setCollocation] = useState<Collocation | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  useEffect(() => {
    if (!supabase || !id) return;
    Promise.all([fetchCollocation(supabase, id), fetchWords(supabase)]).then(([c, allWords]) => {
      setCollocation(c);
      setWords(c ? allWords.filter((w) => c.word_ids.includes(w.id)) : []);
      setLoading(false);
    });
  }, [supabase, id]);

  useEffect(() => {
    if (!supabase || !userId) return;
    supabase
      .from("progress")
      .select("*")
      .then(({ data }) => setProgress((data as ProgressRow[]) ?? []));
  }, [supabase, userId]);

  const locked = !!userId && !!collocation && !isUnlocked(collocation, progress);

  return (
    <div>
      <TopBar title={collocation?.chunk ?? "Chi tiết cụm từ"} back />
      {loading && <p className="p-6 text-center text-gray-400">Đang tải…</p>}
      {!loading && !collocation && (
        <p className="p-6 text-center text-gray-500">Không tìm thấy cụm từ này.</p>
      )}
      {collocation && (
        <>
          <CollocationDetail collocation={collocation} words={words} locked={locked} />
          {locked && (
            <p className="mx-4 mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              🔒 Cụm này chưa mở khoá — học thuộc các từ đơn cấu thành (Level 1) để nó được ưu tiên
              trong phiên luyện. Bạn vẫn luyện được ngay nếu muốn.
            </p>
          )}
          {/* CTA nối sang Practice Level 2 (luyện chính cụm này) */}
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
