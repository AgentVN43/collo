"use client";

import { useState } from "react";
import Link from "next/link";
import type { Collocation, Register, Word } from "@/lib/types";
import { REGISTER_HINTS, REGISTER_LABELS } from "@/lib/types";
import SpeakButton from "./SpeakButton";
import ConversationSheet from "./ConversationSheet";
import AiPracticeButton from "./AiPracticeButton";

const REGISTER_STYLE: Record<Register, string> = {
  formal: "bg-indigo-50 border-indigo-200 text-indigo-800",
  casual: "bg-emerald-50 border-emerald-200 text-emerald-800",
};

export function RegisterBadge({ register, className = "" }: { register: Register; className?: string }) {
  return (
    <span
      title={REGISTER_HINTS[register]}
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${REGISTER_STYLE[register]} ${className}`}
    >
      {REGISTER_LABELS[register]}
    </span>
  );
}

/** Nội dung chi tiết của một CÁCH NÓI — dùng ở /collocation/[id] và bottom sheet Practice. */
export default function CollocationDetail({
  collocation,
  words = [],
  siblings = [],
}: {
  collocation: Collocation;
  /** Các từ đơn cấu thành (để link ngược về /word/[id]). */
  words?: Word[];
  /** Cách nói khác cùng ý định — phần cốt lõi của mô hình Intent. */
  siblings?: Collocation[];
}) {
  const [translationOpen, setTranslationOpen] = useState(false);

  return (
    <div className="px-4 pb-6">
      {/* Ý định giao tiếp: đặt lên đầu vì đó là cái người học muốn nói */}
      {collocation.intent && (
        <div className="mt-4 rounded-xl bg-purple-50 border border-purple-200 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase text-purple-500">Ý định giao tiếp</p>
          <p className="font-semibold text-purple-900">{collocation.intent.name_vi}</p>
          {collocation.intent.description_vi && (
            <p className="mt-0.5 text-sm text-purple-800">{collocation.intent.description_vi}</p>
          )}
        </div>
      )}

      {/* Khối đầu */}
      <div className="py-4 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl font-bold text-gray-900">{collocation.chunk}</span>
          <SpeakButton text={collocation.chunk} />
          <RegisterBadge register={collocation.register} />
        </div>
        <p className="mt-2 text-gray-800">{collocation.literal_meaning}</p>
        <p className="mt-1 text-xs text-gray-500">{REGISTER_HINTS[collocation.register]}</p>
        {collocation.topic && collocation.topic !== "Chưa phân loại" && (
          <span className="mt-2 inline-block rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {collocation.topic}
          </span>
        )}
      </div>

      {/* Cách nói khác cùng ý định */}
      {siblings.length > 0 && (
        <div className="py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">
            Cùng ý định, khác hoàn cảnh
          </h2>
          <ul className="space-y-2">
            {siblings.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/collocation/${s.id}`}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5"
                >
                  <RegisterBadge register={s.register} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-gray-900">{s.chunk}</span>
                    <span className="block truncate text-sm text-gray-600">{s.literal_meaning}</span>
                  </span>
                  <span className="text-gray-300">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cách dùng */}
      {collocation.note_vi && (
        <div className="py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-1">Cách dùng</h2>
          <p className="text-gray-800 leading-relaxed">{collocation.note_vi}</p>
        </div>
      )}

      {/* Từ đơn cấu thành */}
      {words.length > 0 && (
        <div className="py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Ghép từ</h2>
          <div className="flex flex-wrap gap-2">
            {words.map((w) => (
              <Link
                key={w.id}
                href={`/word/${w.id}`}
                className="rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-800"
              >
                {w.word}
                <span className="ml-1.5 text-xs text-gray-400">{w.meaning_vi}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Ví dụ */}
      {collocation.examples.length > 0 && (
        <div className="py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Ví dụ</h2>
          <div className="rounded-lg bg-blue-50 px-3 py-2 space-y-2">
            {collocation.examples.map((ex, i) => (
              <div key={i}>
                <p className="flex flex-wrap items-center gap-2 text-gray-900">
                  <span className="italic">{ex.en}</span>
                  <SpeakButton text={ex.en} className="text-base" />
                  {ex.pattern && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {ex.pattern}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600">{ex.vi}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hội thoại mẫu — chỉ tiếng Anh; bản dịch mở riêng qua nút ⓘ để không phá việc
          luyện đọc hiểu (thấy tiếng Việt ngay là mắt sẽ đọc tiếng Việt trước). */}
      {collocation.conversation.length > 0 && (
        <div className="py-4">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase text-gray-500">Hội thoại mẫu</h2>
            <button
              onClick={() => setTranslationOpen(true)}
              aria-label="Xem bản dịch hội thoại"
              title="Xem bản dịch"
              className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs font-serif font-bold text-gray-500 active:bg-gray-100"
            >
              i
            </button>
          </div>
          <div className="space-y-2">
            {collocation.conversation.map((turn, i) => {
              // Lượt của người nói đầu tiên căn trái, người còn lại căn phải
              const isFirst = turn.speaker === collocation.conversation[0].speaker;
              return (
                <div key={i} className={`flex ${isFirst ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      isFirst
                        ? "rounded-bl-sm bg-gray-100 text-gray-900"
                        : "rounded-br-sm bg-blue-600 text-white"
                    }`}
                  >
                    <p className="text-xs opacity-70">{turn.speaker}</p>
                    <p className="flex items-center gap-1.5 text-sm">
                      {turn.text}
                      <SpeakButton text={turn.text} className="text-sm" />
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AiPracticeButton collocation={collocation} />

      <ConversationSheet
        open={translationOpen}
        conversation={collocation.conversation}
        onClose={() => setTranslationOpen(false)}
      />
    </div>
  );
}
