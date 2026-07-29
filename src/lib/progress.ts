import type { ProgressRow, Word } from "./types";

/** Spacing ladder (days) indexed by mastery after the session. */
const DUE_DAYS = [1, 1, 3, 7, 14, 14];

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
  wordId: string,
  partnershipKey: string,
  level: number
): ProgressRow {
  return {
    user_id: userId,
    word_id: wordId,
    partnership_key: partnershipKey,
    level,
    attempts: 0,
    fails: 0,
    near_misses: 0,
    mastery: 0,
    last_practiced: null,
    next_due: null,
  };
}

/**
 * Chọn partnership để luyện Level 2 (cloze): mastery thấp nhất trước, trong số các
 * partnership có sẵn cloze. `allowed` = category đang bật trong Settings; null nếu
 * category của từ không nằm trong danh sách bật.
 */
export function pickPartnership(word: Word, rows: ProgressRow[]): string | null {
  const available = word.partnerships.filter((p) => (p.cloze?.length ?? 0) > 0);
  if (available.length === 0) return null;
  let best = available[0].key;
  let bestMastery = Infinity;
  for (const p of available) {
    const row = rows.find((r) => r.word_id === word.id && r.partnership_key === p.key && r.level === 2);
    const m = row?.mastery ?? -1; // never practiced sorts first
    if (m < bestMastery) {
      bestMastery = m;
      best = p.key;
    }
  }
  return best;
}

/** Word-level mastery for the Home dot: gray = never practiced, yellow = in progress, green = solid. */
export function wordDot(word: Word, rows: ProgressRow[]): "gray" | "yellow" | "green" {
  const mine = rows.filter((r) => r.word_id === word.id);
  if (mine.length === 0) return "gray";
  const l2 = mine.filter((r) => r.level === 2);
  const keys = word.partnerships.map((p) => p.key);
  if (keys.length === 0) return "gray";
  const solid = keys.every((k) => (l2.find((r) => r.partnership_key === k)?.mastery ?? 0) >= 4);
  return solid ? "green" : "yellow";
}

/**
 * Priority queue for practice-session word picking:
 * 1) overdue reviews, 2) highest fail-rate, 3) new words, 4) lowest mastery.
 */
export function buildQueue(words: Word[], rows: ProgressRow[]): Word[] {
  const today = new Date().toISOString().slice(0, 10);
  const byWord = new Map<string, ProgressRow[]>();
  for (const r of rows) {
    if (r.level !== 1) continue;
    const list = byWord.get(r.word_id) ?? [];
    list.push(r);
    byWord.set(r.word_id, list);
  }

  const scored = words.map((w) => {
    const mine = byWord.get(w.id) ?? [];
    const overdue = mine.some((r) => r.next_due !== null && r.next_due <= today);
    const attempts = mine.reduce((s, r) => s + r.attempts, 0);
    const fails = mine.reduce((s, r) => s + r.fails, 0);
    const failRate = attempts > 0 ? fails / attempts : 0;
    const avgMastery = mine.length ? mine.reduce((s, r) => s + r.mastery, 0) / mine.length : 0;
    const isNew = mine.length === 0;

    let priority = 0;
    if (overdue) priority = 4000;
    else if (failRate > 0.3) priority = 3000 + failRate * 100;
    else if (isNew) priority = 1000;
    else priority = 500 - avgMastery;
    return { w, priority };
  });

  return scored.sort((a, b) => b.priority - a.priority).map((s) => s.w);
}
