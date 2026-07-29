"use client";

import { ACCENT_CHARS } from "@/lib/french";

/** Hàng ký tự có dấu tiếng Pháp — tap để chèn vào input đang focus. */
export default function AccentBar({ onInsert }: { onInsert: (ch: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto py-2">
      {ACCENT_CHARS.map((ch) => (
        <button
          key={ch}
          type="button"
          // onMouseDown/onTouchStart + preventDefault để không làm mất focus của input
          onMouseDown={(e) => {
            e.preventDefault();
            onInsert(ch);
          }}
          className="min-w-9 h-9 px-2 rounded-lg border border-gray-300 bg-gray-50 text-lg leading-none active:bg-blue-100"
        >
          {ch}
        </button>
      ))}
    </div>
  );
}
