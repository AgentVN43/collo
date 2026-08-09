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

/**
 * Viết tắt được bung ra trước khi so, để "I'm" và "I am" không bị tính là sai khác.
 * Cố tình KHÔNG đụng tới `'s` — nó vừa là "is" vừa là sở hữu cách, đoán bừa sẽ hại hơn lợi.
 */
const CONTRACTIONS: [RegExp, string][] = [
  [/\bwon't\b/g, "will not"],
  [/\bcan't\b/g, "can not"],
  [/\bshan't\b/g, "shall not"],
  [/n't\b/g, " not"],
  [/'m\b/g, " am"],
  [/'re\b/g, " are"],
  [/'ve\b/g, " have"],
  [/'ll\b/g, " will"],
];

/** Tách thành từ: bỏ hoa thường, dấu câu, và bung viết tắt. */
export function tokenize(s: string): string[] {
  let t = s.toLowerCase().replace(/[‘’]/g, "'");
  for (const [re, to] of CONTRACTIONS) t = t.replace(re, to);
  return t
    .replace(/[^a-z0-9'\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Khoảng cách chỉnh sửa ở mức TỪ, so khớp TUYỆT ĐỐI từng từ.
 *
 * Trước đây hai từ lệch 1 ký tự được coi là trùng, nhưng dung sai đó áp cho từng từ một
 * cách độc lập nên sai bao nhiêu từ cũng lọt — "fuliy satisfsied with the outcome" hỏng
 * hai từ mà vẫn được tính là khớp hoàn hảo. Giờ mọi loại sai đều tính một đơn vị hỏng:
 * gõ sai chính tả ngang với thiếu hẳn một từ.
 */
function tokenDistance(a: string[], b: string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const same = a[i - 1] === b[j - 1];
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

/**
 * Chấm một câu CHỨA cụm mục tiêu — dùng khi đề bài yêu cầu đáp lại thành câu
 * ("I'm swamped with work right now" cho cụm "swamped with work").
 *
 * Nói được cụm trong một câu hoàn chỉnh không hề kém hơn nói cụm trần, nên các từ
 * xung quanh không bị tính là lỗi. Chỉ đoạn khớp với cụm mới được chấm; cửa sổ nới
 * ±1 từ để dung được biến thể ("I'm swamped with all this work").
 *
 * `correct` đòi cụm ĐÚNG NGUYÊN VẸN — nó là thứ đang được dạy. Sai một từ (dù chỉ sai
 * chính tả) chỉ được `near`; sai từ hai từ trở lên là `wrong`.
 */
export function gradeContains(input: string, chunk: string): GradeResult {
  const given = tokenize(input);
  const target = tokenize(chunk);
  if (given.length === 0 || target.length === 0) return "wrong";
  // Câu ngắn hơn cụm thì không thể "chứa" — so thẳng
  if (given.length <= target.length) return gradeChunk(input, chunk);

  let best = Infinity;
  for (let start = 0; start < given.length; start++) {
    for (const len of [target.length - 1, target.length, target.length + 1]) {
      if (len <= 0 || start + len > given.length) continue;
      best = Math.min(best, tokenDistance(given.slice(start, start + len), target));
      if (best === 0) return "correct"; // cụm xuất hiện nguyên vẹn, từng từ khớp tuyệt đối
    }
  }
  return best <= 1 ? "near" : "wrong";
}

/**
 * Chỉ ra CHỖ SAI trong cụm để kết quả không giống một phán quyết tuỳ tiện.
 * Trả về null khi cụm đã đúng nguyên vẹn, hoặc khi câu trả lời lệch quá xa để chỉ trỏ.
 */
export function diffChunk(input: string, chunk: string): string | null {
  const given = tokenize(input);
  const target = tokenize(chunk);
  if (given.length === 0 || target.length === 0) return null;

  // Tìm cửa sổ cùng độ dài khớp nhất với cụm — đó là chỗ người học ĐỊNH viết cụm
  let bestStart = 0;
  let bestHits = -1;
  for (let start = 0; start + target.length <= given.length; start++) {
    const hits = target.filter((w, k) => given[start + k] === w).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestStart = start;
    }
  }
  if (bestHits <= 0) return null; // không nhận ra người học định viết cụm ở đâu

  const wrong: string[] = [];
  target.forEach((want, k) => {
    const got = given[bestStart + k];
    if (got !== want) wrong.push(`“${got}” → “${want}”`);
  });
  // Từ 3 chỗ lệch trở lên thì phép gióng hàng không còn đáng tin: câu thiếu một từ sẽ
  // làm mọi từ sau đó lệch vị trí, chỉ trỏ lúc này là bịa. Im lặng, đáp án đã hiện rồi.
  if (wrong.length === 0 || wrong.length > 2) return null;
  return `Chỗ sai: ${wrong.join(", ")}`;
}
