"use client";

import { useState } from "react";
import BottomSheet from "./BottomSheet";
import { getSupabase } from "@/lib/supabase";
import { submitFeedback } from "@/lib/feedback";
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from "@/lib/types";

export default function FeedbackSheet({
  wordId,
  userId,
  onClose,
}: {
  wordId: string;
  userId: string;
  onClose: () => void;
}) {
  const supabase = getSupabase();
  const [category, setCategory] = useState<FeedbackCategory>("basics");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!supabase || !content.trim() || busy) return;
    setBusy(true);
    try {
      await submitFeedback(supabase, wordId, userId, category, content.trim());
      setSent(true);
    } catch {
      alert("Gửi feedback thất bại, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open onClose={onClose}>
      <div className="px-4 pb-8">
        <h2 className="py-3 font-semibold text-gray-900">Góp ý về từ này</h2>

        {sent ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-2xl">✅</p>
            <p className="font-medium text-gray-900">Cảm ơn bạn đã góp ý!</p>
            <p className="text-sm text-gray-500">Chúng tôi sẽ xem xét và cập nhật sớm nhất.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loại lỗi</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900 outline-none focus:border-blue-500"
              >
                {FEEDBACK_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung góp ý</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Mô tả lỗi bạn phát hiện…"
                rows={4}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900 outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!content.trim() || busy}
              className="w-full rounded-xl bg-blue-600 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Đang gửi…" : "Gửi góp ý"}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
