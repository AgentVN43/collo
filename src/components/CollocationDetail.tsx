"use client";

import { useState } from "react";
import Link from "next/link";
import type { Collocation, Word } from "@/lib/types";
import { VARIANT_LABELS } from "@/lib/types";
import SpeakButton from "./SpeakButton";

const CONTEXT_STYLE: Record<string, string> = {
  casual: "bg-emerald-50 border-emerald-200 text-emerald-800",
  formal: "bg-indigo-50 border-indigo-200 text-indigo-800",
  alternative: "bg-amber-50 border-amber-200 text-amber-800",
};

/** Nội dung chi tiết của một COLLOCATION — dùng ở /collocation/[id] và bottom sheet Practice. */
export default function CollocationDetail({
  collocation,
  words = [],
  locked = false,
}: {
  collocation: Collocation;
  /** Các từ đơn cấu thành (để link ngược về /word/[id]). */
  words?: Word[];
  locked?: boolean;
}) {
  const [openVariant, setOpenVariant] = useState<string | null>(
    collocation.variants[0]?.id ?? null
  );

  return (
    <div className="px-4 pb-6">
      {/* Khối đầu */}
      <div className="py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-900">{collocation.chunk}</span>
          <SpeakButton text={collocation.chunk} />
          {locked && (
            <span className="text-lg" aria-label="Chưa mở khoá" title="Học thuộc các từ đơn để mở khoá">
              🔒
            </span>
          )}
        </div>
        <p className="mt-2 text-gray-800">{collocation.literal_meaning}</p>
        {collocation.topic && collocation.topic !== "Chưa phân loại" && (
          <span className="mt-2 inline-block rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-xs font-medium text-purple-700">
            {collocation.topic}
          </span>
        )}
      </div>

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

      {/* Sắc thái theo ngữ cảnh + hội thoại mẫu */}
      {collocation.variants.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mt-4 mb-2">
            Nói theo ngữ cảnh
          </h2>
          <div className="space-y-2">
            {collocation.variants.map((v) => {
              const isOpen = openVariant === v.id;
              return (
                <div key={v.id} className="rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setOpenVariant(isOpen ? null : v.id)}
                    className="flex w-full items-center gap-2 bg-gray-50 px-4 py-3 text-left"
                  >
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
                        CONTEXT_STYLE[v.context] ?? "bg-gray-100 border-gray-200 text-gray-700"
                      }`}
                    >
                      {VARIANT_LABELS[v.context] ?? v.context}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-medium text-gray-900">
                      {v.text_variant}
                    </span>
                    <span className="text-gray-400">{isOpen ? "▾" : "▸"}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 py-3 space-y-3">
                      <p className="flex items-center gap-2 text-gray-900">
                        <span className="italic">{v.text_variant}</span>
                        <SpeakButton text={v.text_variant} className="text-base" />
                      </p>
                      {v.conversation.length > 0 && (
                        <div className="space-y-2">
                          {v.conversation.map((turn, i) => {
                            // Lượt của người nói đầu tiên căn trái, các người nói khác căn phải
                            const isFirst = turn.speaker === v.conversation[0].speaker;
                            return (
                              <div
                                key={i}
                                className={`flex ${isFirst ? "justify-start" : "justify-end"}`}
                              >
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
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
