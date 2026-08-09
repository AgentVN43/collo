"use client";

import { useState } from "react";
import { buildPracticePrompt, chatGptUrl } from "@/lib/aiPrompt";
import type { Collocation } from "@/lib/types";

/**
 * Lối ra sang một trợ lý AI để luyện hội thoại mở — thứ mà so chuỗi không bao giờ làm được.
 *
 * "Copy prompt" là đường chính vì nó chạy với mọi trợ lý (ChatGPT, Claude, Gemini, app trên
 * máy), còn link ChatGPT dựa vào một tham số URL không có tài liệu nên có thể hỏng bất cứ lúc nào.
 */
export default function AiPracticeButton({ collocation }: { collocation: Collocation }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const prompt = buildPracticePrompt(collocation);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied("idle"), 4000);
  };

  return (
    <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 px-3 py-3">
      <p className="text-sm font-semibold text-purple-900">🤖 Luyện hội thoại với AI</p>
      <p className="mt-0.5 text-xs text-purple-700">
        Mang cụm này sang trợ lý AI để nói chuyện thật. App không chấm phần này — cứ nói thoải mái.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="flex-1 rounded-lg border border-purple-300 bg-white py-2 text-sm font-semibold text-purple-800"
        >
          {copied === "ok" ? "✓ Đã copy" : copied === "fail" ? "Không copy được" : "Copy prompt"}
        </button>
        <a
          href={chatGptUrl(prompt)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-lg bg-purple-600 py-2 text-center text-sm font-semibold text-white"
        >
          Mở ChatGPT ↗
        </a>
      </div>
      {copied === "fail" && (
        <textarea
          readOnly
          value={prompt}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 h-24 w-full rounded-lg border border-purple-200 p-2 text-xs text-gray-700"
        />
      )}
    </div>
  );
}
