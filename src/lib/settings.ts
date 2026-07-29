"use client";

const CATEGORIES_KEY = "folask.enabled_categories";

/**
 * Category đang bật trong Settings > Category to Practice (lưu theo thiết bị).
 * `allSlugs` là danh sách slug hiện có trong DB — dùng để lọc bỏ slug rác/cũ.
 */
export function getEnabledCategories(allSlugs: string[]): string[] {
  if (typeof window === "undefined") return allSlugs;
  try {
    const raw = window.localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return allSlugs;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return allSlugs;
    const valid = parsed.filter((s): s is string => allSlugs.includes(s));
    return valid.length > 0 ? valid : allSlugs;
  } catch {
    return allSlugs;
  }
}

export function setEnabledCategories(slugs: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CATEGORIES_KEY, JSON.stringify(slugs));
}

// ---- Cài đặt phiên luyện tập ----

export type PracticeMode = "free" | "collection";

export interface PracticeSettings {
  mode: PracticeMode; // free: random toàn kho; collection: chọn bộ sưu tập trước khi luyện
  quantity: number; // số từ mỗi phiên
}

const PRACTICE_KEY = "folask.practice_settings";
const DEFAULT_PRACTICE: PracticeSettings = { mode: "free", quantity: 5 };

export function clampQuantity(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PRACTICE.quantity;
  return Math.min(50, Math.max(1, Math.round(n)));
}

export function getPracticeSettings(): PracticeSettings {
  if (typeof window === "undefined") return DEFAULT_PRACTICE;
  try {
    const raw = window.localStorage.getItem(PRACTICE_KEY);
    if (!raw) return DEFAULT_PRACTICE;
    const parsed = JSON.parse(raw);
    return {
      mode: parsed?.mode === "collection" ? "collection" : "free",
      quantity: clampQuantity(Number(parsed?.quantity)),
    };
  } catch {
    return DEFAULT_PRACTICE;
  }
}

export function setPracticeSettings(s: PracticeSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    PRACTICE_KEY,
    JSON.stringify({ mode: s.mode, quantity: clampQuantity(s.quantity) })
  );
}
