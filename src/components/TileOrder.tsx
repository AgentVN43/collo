"use client";

/**
 * Ghép thứ tự các từ trong một chunk bằng thẻ bấm.
 *
 * Làm việc trên CHỈ SỐ chứ không trên chuỗi: một chunk hoàn toàn có thể lặp từ
 * ("get the ball rolling on the project"), nếu dùng chuỗi thì bấm thẻ "the" thứ hai
 * sẽ gỡ nhầm thẻ "the" thứ nhất.
 */
export default function TileOrder({
  tiles,
  value,
  onChange,
  disabled = false,
}: {
  /** Các từ đã xáo thứ tự. */
  tiles: string[];
  /** Chỉ số các thẻ đã đặt, theo đúng thứ tự người học chọn. */
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
}) {
  const remaining = tiles.map((_, i) => i).filter((i) => !value.includes(i));

  return (
    <div className="mt-4 space-y-3">
      {/* Ô đáp án — bấm một thẻ đã đặt để gỡ nó ra */}
      <div className="flex min-h-16 flex-wrap content-start gap-2 rounded-xl border-2 border-dashed border-gray-300 p-2">
        {value.length === 0 && (
          <span className="px-1 py-2 text-sm text-gray-400">
            Bấm các thẻ bên dưới theo đúng thứ tự…
          </span>
        )}
        {value.map((tileIdx, pos) => (
          <button
            key={`${tileIdx}-${pos}`}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value.filter((_, p) => p !== pos))}
            className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-70"
          >
            {tiles[tileIdx]}
          </button>
        ))}
      </div>

      {/* Thẻ chưa dùng */}
      <div className="flex flex-wrap gap-2">
        {remaining.map((tileIdx) => (
          <button
            key={tileIdx}
            type="button"
            disabled={disabled}
            onClick={() => onChange([...value, tileIdx])}
            className="rounded-lg border-2 border-gray-300 bg-white px-3 py-2 font-semibold text-gray-800 active:bg-gray-100 disabled:opacity-50"
          >
            {tiles[tileIdx]}
          </button>
        ))}
      </div>
    </div>
  );
}
