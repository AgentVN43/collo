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

/** Tách thành từ, bỏ dấu câu và phân biệt hoa thường. */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Khoảng cách chỉnh sửa ở mức TỪ. Hai từ chỉ lệch 1 ký tự (lỗi gõ) coi như trùng. */
function tokenDistance(a: string[], b: string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const same = a[i - 1] === b[j - 1] || levenshteinAtMost(a[i - 1], b[j - 1], 1);
      curr.push(Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + (same ? 0 : 1)));
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Chấm một CỤM gõ tay. Khác `grade()` ở chỗ so theo TỪ chứ không theo ký tự:
 * trên chuỗi dài, "lệch 1 ký tự" là ngưỡng vô nghĩa — thiếu hẳn một mạo từ chỉ
 * tốn 4 ký tự nên bị chấm như gõ bừa, còn thừa dấu chấm lại được tha.
 *
 * `near` = lệch đúng một từ (thiếu / thừa / sai một từ), tính nửa điểm.
 */
export function gradeChunk(input: string, answer: string): GradeResult {
  const given = tokenize(input);
  if (given.length === 0) return "wrong";
  const expected = tokenize(answer);
  if (given.join(" ") === expected.join(" ")) return "correct";
  return tokenDistance(given, expected) <= 1 ? "near" : "wrong";
}
