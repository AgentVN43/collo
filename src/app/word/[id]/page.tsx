"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import WordDetail from "@/components/WordDetail";
import CollectionSheet from "@/components/CollectionSheet";
import FeedbackSheet from "@/components/FeedbackSheet";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { fetchWord } from "@/lib/words";
import { collocationsForWord, fetchCollocations } from "@/lib/collocations";
import { membershipForWord } from "@/lib/collections";
import type { Collocation, Word } from "@/lib/types";

export default function WordPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useSession();
  const [word, setWord] = useState<Word | null>(null);
  const [collocations, setCollocations] = useState<Collocation[]>([]);
  const [saved, setSaved] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  useEffect(() => {
    if (!supabase || !id) return;
    Promise.all([fetchWord(supabase, id), fetchCollocations(supabase)]).then(([w, all]) => {
      setWord(w);
      setCollocations(collocationsForWord(all, id));
      setLoading(false);
    });
  }, [supabase, id]);

  useEffect(() => {
    if (!supabase || !userId || !id) return;
    membershipForWord(supabase, id).then((mem) => setSaved(mem.size > 0));
  }, [supabase, userId, id]);

  const openSheet = () => {
    if (!word) return;
    if (!userId) {
      router.push(`/login?next=/word/${word.id}`);
      return;
    }
    setSheetOpen(true);
  };

  return (
    <div>
      <TopBar title={word?.word ?? "Chi tiết từ"} back />
      {loading && <p className="p-6 text-center text-gray-400">Đang tải…</p>}
      {!loading && !word && <p className="p-6 text-center text-gray-500">Không tìm thấy từ này.</p>}
      {word && (
        <>
          <WordDetail
            word={word}
            collocations={collocations}
            saved={saved}
            onToggleSave={openSheet}
            onFeedback={() => {
              if (!userId) {
                router.push(`/login?next=/word/${word.id}`);
                return;
              }
              setFeedbackOpen(true);
            }}
          />
          {/* CTA nối word_detail → Practice Level 1 (luyện chính từ đơn này) */}
          <div className="fixed bottom-16 inset-x-0 z-30">
            <div className="mx-auto max-w-md px-4 pb-3">
              <button
                onClick={() => router.push(`/practice?word=${word.id}`)}
                className="w-full rounded-2xl bg-blue-600 py-3.5 text-white font-semibold text-lg shadow-lg active:bg-blue-700"
              >
                Luyện từ này
              </button>
            </div>
          </div>
          {userId && feedbackOpen && (
            <FeedbackSheet
              wordId={word.id}
              userId={userId}
              onClose={() => setFeedbackOpen(false)}
            />
          )}
          {userId && (
            <CollectionSheet
              wordId={sheetOpen ? word.id : null}
              userId={userId}
              onClose={() => setSheetOpen(false)}
              onSavedChange={(_id, isSaved) => setSaved(isSaved)}
            />
          )}
        </>
      )}
    </div>
  );
}
