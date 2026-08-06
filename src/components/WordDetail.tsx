"use client";

import Link from "next/link";
import type { Collocation, Word } from "@/lib/types";
import SpeakButton from "./SpeakButton";
import { RegisterBadge } from "./CollocationDetail";

/** Nội dung chi tiết của một TỪ ĐƠN — dùng ở /word/[id] và bottom sheet trong Practice. */
export default function WordDetail({
  word,
  collocations = [],
  saved,
  onToggleSave,
  onFeedback,
}: {
  word: Word;
  /** Các collocation có chứa từ này. */
  collocations?: Collocation[];
  saved?: boolean;
  onToggleSave?: () => void;
  onFeedback?: () => void;
}) {
  return (
    <div className="px-4 pb-6">
      {/* Khối đầu */}
      <div className="py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-gray-900">{word.word}</span>
          <SpeakButton text={word.word} />
          <span className="text-sm text-gray-500 italic">{word.word_type}</span>
          <span className="ml-auto flex items-center gap-1">
            {onFeedback && (
              <button
                onClick={onFeedback}
                aria-label="Góp ý về từ này"
                className="text-2xl opacity-40 hover:opacity-70"
              >
                💬
              </button>
            )}
            {onToggleSave && (
              <button
                onClick={onToggleSave}
                aria-label="Lưu vào bộ sưu tập"
                className={`text-2xl ${saved ? "" : "grayscale opacity-40"}`}
              >
                🔖
              </button>
            )}
          </span>
        </div>
        <p className="mt-2 text-gray-800">{word.meaning_vi}</p>
        <p className="text-sm text-gray-500">{word.meaning_en}</p>
      </div>

      {/* Kiến thức cơ bản */}
      {word.basics_vi && (
        <div className="py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-1">Kiến thức cơ bản</h2>
          <p className="text-gray-800 leading-relaxed">{word.basics_vi}</p>
        </div>
      )}

      {/* Collocation ghép từ từ này */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase mt-4 mb-2">
        Collocation chứa từ này
      </h2>
      {collocations.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500">
          Chưa có collocation nào dùng từ này.
        </p>
      ) : (
        <ul className="space-y-2">
          {collocations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/collocation/${c.id}`}
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3"
              >
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-gray-900">{c.chunk}</span>
                    <RegisterBadge register={c.register} />
                  </span>
                  <span className="block truncate text-sm text-gray-600">{c.literal_meaning}</span>
                  {c.intent && (
                    <span className="block truncate text-xs text-purple-600">
                      🎯 {c.intent.name_vi}
                    </span>
                  )}
                </span>
                <span className="text-gray-300">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
