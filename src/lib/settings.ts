"use client";

import { DEFAULT_ENABLED_TENSES, TENSE_KEYS, type TenseKey } from "./types";

const STORAGE_KEY = "folask.enabled_tenses";

/** Các thì đang bật trong Settings > Tense to Practice (lưu theo thiết bị). */
export function getEnabledTenses(): TenseKey[] {
  if (typeof window === "undefined") return DEFAULT_ENABLED_TENSES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ENABLED_TENSES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ENABLED_TENSES;
    const valid = parsed.filter((t): t is TenseKey => (TENSE_KEYS as readonly string[]).includes(t));
    return valid.length > 0 ? valid : DEFAULT_ENABLED_TENSES;
  } catch {
    return DEFAULT_ENABLED_TENSES;
  }
}

export function setEnabledTenses(tenses: TenseKey[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tenses));
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
