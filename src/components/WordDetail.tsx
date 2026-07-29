"use client";

import { useState } from "react";
import type { Word, TenseKey, PronounKey } from "@/lib/types";
import { TENSE_KEYS, TENSE_LABELS, PRONOUN_KEYS } from "@/lib/types";
import { joinPronoun } from "@/lib/french";
import SpeakButton from "./SpeakButton";

/** Nội dung chi tiết của một từ — dùng ở trang /word/[id] và bottom sheet trong Practice. */
export default function WordDetail({
  word,
  saved,
  onToggleSave,
  onFeedback,
}: {
  word: Word;
  saved?: boolean;
  onToggleSave?: () => void;
  onFeedback?: () => void;
}) {
  const [open, setOpen] = useState<TenseKey | null>("present");

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
                aria-label="Lưu vào Wishlist"
                className={`text-2xl ${saved ? "" : "grayscale opacity-40"}`}
              >
                🔖
              </button>
            )}
          </span>
        </div>
        <p className="mt-2 text-gray-800">{word.meaning_vi}</p>
        <p className="text-sm text-gray-500">{word.meaning_en}</p>
        {/* 1 badge duy nhất = category (nhóm chia); tính chất khác nằm trong Kiến thức cơ bản */}
        {word.topic && word.topic !== "Chưa phân loại" && (
          <span className="mt-2 inline-block rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-xs font-medium text-purple-700">
            {word.topic}
          </span>
        )}
      </div>

      {/* Kiến thức cơ bản */}
      {word.basics_vi && (
        <div className="py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-1">Kiến thức cơ bản</h2>
          <p className="text-gray-800 leading-relaxed">{word.basics_vi}</p>
        </div>
      )}

      {/* Chia động từ theo thì — accordion, không dùng bảng */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase mt-4 mb-2">Chia động từ</h2>
      <div className="space-y-2">
        {TENSE_KEYS.map((tense) => {
          const data = word.conjugations[tense];
          if (!data) return null;
          const isOpen = open === tense;
          return (
            <div key={tense} className="rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : tense)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left"
              >
                <span className="font-semibold text-gray-900">{TENSE_LABELS[tense]}</span>
                <span className="text-gray-400">{isOpen ? "▾" : "▸"}</span>
              </button>
              {isOpen && (
                <div className="px-4 py-3 space-y-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Quy tắc: </span>
                    {data.rule_vi}
                  </p>
                  <div className="space-y-1">
                    {PRONOUN_KEYS.map((p: PronounKey) => (
                      <div key={p} className="flex items-center gap-2 text-gray-900">
                        <span className="font-medium">{joinPronoun(p, data.forms[p])}</span>
                        <SpeakButton text={joinPronoun(p, data.forms[p])} className="text-base" />
                      </div>
                    ))}
                  </div>
                  {data.examples.length > 0 && (
                    <div className="rounded-lg bg-blue-50 px-3 py-2 space-y-2">
                      {data.examples.map((ex, i) => (
                        <div key={i}>
                          <p className="text-gray-900 flex items-center gap-2">
                            <span className="italic">{ex.fr}</span>
                            <SpeakButton text={ex.fr} className="text-base" />
                          </p>
                          <p className="text-sm text-gray-600">{ex.vi}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
