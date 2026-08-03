import type { Collocation, ProgressItemType, ProgressRow } from "./types";

/** Spacing ladder (days) indexed by mastery after the session. */
const DUE_DAYS = [1, 1, 3, 7, 14, 14];

/** Mastery tối thiểu của một TỪ ĐƠN để coi là "đã thuộc" → mở khoá collocation chứa nó. */
export const LEARNED_THRESHOLD = 3;

/** Mastery coi như thành thạo (chấm xanh ở Home, tab "Thành thạo" ở Progress). */
export const SOLID_THRESHOLD = 4;

export interface SessionResult {
  correct: number;
  near: number;
  wrong: number;
}

export function sessionScore(r: SessionResult): number {
  const total = r.correct + r.near + r.wrong;
  if (total === 0) return 0;
  // near-misses (lỗi gõ nhỏ) tính nửa điểm
  return (r.correct + r.near * 0.5) / total;
}

/** Apply one finished session to a progress row (the "activation" row must already exist). */
export function applySession(row: ProgressRow, r: SessionResult): ProgressRow {
  const score = sessionScore(r);
  let mastery = row.mastery;
  if (score >= 0.8) mastery = Math.min(5, mastery + 1);
  else if (score < 0.5) mastery = Math.max(0, mastery - 1);
  const due = new Date();
  due.setDate(due.getDate() + DUE_DAYS[mastery]);
  return {
    ...row,
    attempts: row.attempts + r.correct + r.near + r.wrong,
    fails: row.fails + r.wrong,
    near_misses: row.near_misses + r.near,
    mastery,
    last_practiced: new Date().toISOString(),
    next_due: due.toISOString().slice(0, 10),
  };
}

export function emptyRow(
  userId: string,
  itemType: ProgressItemType,
  itemId: string
): ProgressRow {
  return {
    user_id: userId,
    item_type: itemType,
    item_id: itemId,
    attempts: 0,
    fails: 0,
    near_misses: 0,
    mastery: 0,
    last_practiced: null,
    next_due: null,
  };
}

export function findRow(
  rows: ProgressRow[],
  itemType: ProgressItemType,
  itemId: string
): ProgressRow | undefined {
  return rows.find((r) => r.item_type === itemType && r.item_id === itemId);
}

export function masteryOf(
  rows: ProgressRow[],
  itemType: ProgressItemType,
  itemId: string
): number {
  return findRow(rows, itemType, itemId)?.mastery ?? 0;
}

/** Chấm tiến độ ở Home: xám = chưa luyện, vàng = đang học, xanh = thành thạo. */
export function masteryDot(
  rows: ProgressRow[],
  itemType: ProgressItemType,
  itemId: string
): "gray" | "yellow" | "green" {
  const row = findRow(rows, itemType, itemId);
  if (!row || row.attempts === 0) return "gray";
  return row.mastery >= SOLID_THRESHOLD ? "green" : "yellow";
}

/**
 * Collocation được mở khoá khi MỌI từ đơn cấu thành đã thuộc (mastery >= 3).
 * Collocation chưa liên kết từ đơn nào coi như mở sẵn (không có điều kiện để chặn).
 */
export function isUnlocked(collocation: Collocation, rows: ProgressRow[]): boolean {
  if (collocation.word_ids.length === 0) return true;
  return collocation.word_ids.every((id) => masteryOf(rows, "word", id) >= LEARNED_THRESHOLD);
}

/**
 * Hàng đợi ưu tiên cho phiên luyện, dùng chung cho cả từ đơn lẫn collocation:
 * 1) quá hạn ôn, 2) fail-rate cao, 3) mục mới, 4) mastery thấp.
 * `boost` cộng thêm điểm ưu tiên cho từng mục (dùng để đẩy collocation đã mở khoá lên trước).
 */
export function buildQueue<T extends { id: string }>(
  items: T[],
  rows: ProgressRow[],
  itemType: ProgressItemType,
  boost?: (item: T) => number
): T[] {
  const today = new Date().toISOString().slice(0, 10);
  const byItem = new Map<string, ProgressRow>();
  for (const r of rows) {
    if (r.item_type === itemType) byItem.set(r.item_id, r);
  }

  const scored = items.map((item) => {
    const row = byItem.get(item.id);
    const overdue = row?.next_due != null && row.next_due <= today;
    const failRate = row && row.attempts > 0 ? row.fails / row.attempts : 0;

    let priority: number;
    if (overdue) priority = 4000;
    else if (failRate > 0.3) priority = 3000 + failRate * 100;
    else if (!row) priority = 1000;
    else priority = 500 - row.mastery;
    return { item, priority: priority + (boost?.(item) ?? 0) };
  });

  return scored.sort((a, b) => b.priority - a.priority).map((s) => s.item);
}
