"use client";

import { useEffect } from "react";
import type { ConversationTurn } from "@/lib/types";
import SpeakButton from "./SpeakButton";

/**
 * Sheet xem bản dịch hội thoại.
 *
 * Cố tình KHÔNG dùng vaul như BottomSheet: component này được mở từ trong
 * CollocationDetail, mà CollocationDetail lại nằm sẵn trong một vaul Drawer ở màn
 * Practice — lồng Drawer trong Drawer rất dễ vỡ. Overlay thuần z-[60] nằm trên
 * Drawer (z-50) nên hoạt động ở mọi chỗ.
 */
export default function ConversationSheet({
  open,
  conversation,
  onClose,
}: {
  open: boolean;
  conversation: ConversationTurn[];
  onClose: () => void;
}) {
  // Esc để đóng — sheet phủ toàn màn nên cần lối thoát bằng bàn phím
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        aria-label="Đóng"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/40"
      />
      <div className="relative mx-auto flex max-h-[85%] w-full max-w-md flex-col rounded-t-2xl bg-white">
        <div className="shrink-0 border-b border-gray-100 px-4 py-3">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-gray-300" />
          <div className="flex items-center">
            <h2 className="flex-1 font-semibold text-gray-900">Hội thoại &amp; bản dịch</h2>
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1 text-sm font-medium text-gray-500"
            >
              Đóng
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          {conversation.map((turn, i) => (
            <div key={i} className="rounded-xl border border-gray-200 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase text-gray-400">{turn.speaker}</p>
              <p className="mt-0.5 flex items-start gap-1.5 text-gray-900">
                <span className="flex-1">{turn.text}</span>
                <SpeakButton text={turn.text} className="mt-0.5 shrink-0 text-base" />
              </p>
              {turn.translate ? (
                <p className="mt-1.5 border-t border-dashed border-gray-200 pt-1.5 text-sm text-gray-600">
                  {turn.translate}
                </p>
              ) : (
                <p className="mt-1.5 border-t border-dashed border-gray-200 pt-1.5 text-sm text-gray-400 italic">
                  (chưa có bản dịch)
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
