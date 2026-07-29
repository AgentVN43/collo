function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/['']/g, "'");
}

/** true nếu khoảng cách chỉnh sửa (Levenshtein) giữa a và b ≤ max. */
function levenshteinAtMost(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  let prev = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      curr.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return false; // cắt sớm
    prev = curr;
  }
  return prev[lb] <= max;
}

export type GradeResult = "correct" | "near" | "wrong";

/**
 * Chấm một câu trả lời. "near" = chỉ lệch tối đa 1 ký tự (lỗi gõ nhỏ), tính nửa điểm
 * chứ không phạt như sai hẳn. Alternatives (vd "sync with" / "sync to") đều tính đúng.
 */
export function grade(input: string, answer: string, alts: string[] = []): GradeResult {
  const given = normalize(input);
  if (!given) return "wrong";
  const accepted = [answer, ...alts].map(normalize);
  if (accepted.includes(given)) return "correct";
  if (accepted.some((a) => levenshteinAtMost(a, given, 1))) return "near";
  return "wrong";
}
