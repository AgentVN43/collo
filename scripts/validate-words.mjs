// Kiểm tra cấu trúc dữ liệu từ vựng TRƯỚC khi import vào Supabase.
//   node scripts/validate-words.mjs                  → kiểm tra seed/words.mjs
//   node scripts/validate-words.mjs content/x.json   → kiểm tra file JSON (1 object hoặc mảng)
// Exit code 0 = đạt, 1 = có lỗi. Warning không chặn import nhưng nên xem lại.
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { categories as CATEGORY_REGISTRY } from "../seed/categories.mjs";

const CATEGORY_SLUGS = new Set(CATEGORY_REGISTRY.map((c) => c.slug));

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Tìm file theo thứ tự: đường dẫn như gõ → tương đối từ gốc project (chấp nhận cả "/content/x.json"). */
function resolveInput(input) {
  const candidates = [resolve(input), join(PROJECT_ROOT, input.replace(/^[\\/]+/, ""))];
  for (const p of candidates) if (existsSync(p)) return p;
  console.error(`Không tìm thấy file. Đã thử:\n  - ${candidates.join("\n  - ")}`);
  console.error(`\nCách dùng: npm run validate content/test.json`);
  process.exit(1);
}


const TENSES = [
  "present", "passe_compose", "futur_proche",
  "imparfait", "futur_simple", "plus_que_parfait", "futur_anterieur", "passe_simple", "passe_anterieur",
  "subj_present", "subj_passe", "subj_imparfait", "subj_plus_que_parfait",
  "cond_present", "cond_passe",
];
const PRONOUNS = ["j", "tu", "il_elle", "nous", "vous", "elles"];

const file = process.argv[2];
let words;
if (!file) {
  ({ words } = await import("../seed/words.mjs"));
} else {
  const path = resolveInput(file);
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`File không phải JSON hợp lệ: ${path}\n${e.message}`);
    process.exit(1);
  }
  words = Array.isArray(raw) ? raw : [raw];
}

const errors = [];
const warnings = [];
const seen = new Set();

for (const w of words) {
  const id = w?.word ?? "(không có word)";
  const err = (m) => errors.push(`[${id}] ${m}`);
  const warn = (m) => warnings.push(`[${id}] ${m}`);

  if (typeof w?.word !== "string" || !w.word.trim()) err(`thiếu "word"`);
  else {
    const key = w.word.trim().toLowerCase();
    if (seen.has(key)) err(`trùng lặp word "${key}" trong cùng file`);
    seen.add(key);
    if (w.word !== key) warn(`word nên viết thường: "${w.word}"`);
  }
  for (const field of ["meaning_vi", "meaning_en"]) {
    if (typeof w?.[field] !== "string" || !w[field].trim()) err(`thiếu "${field}"`);
  }
  // category: đúng 1 slug nhóm chia (quyết định section ở Home)
  if (typeof w?.category !== "string" || !w.category.trim()) {
    err(`thiếu "category" — mỗi từ phải thuộc đúng 1 nhóm chia (${[...CATEGORY_SLUGS].join(" / ")})`);
  } else if (!CATEGORY_SLUGS.has(w.category)) {
    err(`category "${w.category}" không có trong seed/categories.mjs (hợp lệ: ${[...CATEGORY_SLUGS].join(", ")})`);
  }
  if (!w?.basics_vi) warn(`thiếu "basics_vi" — word_detail sẽ trống phần kiến thức cơ bản`);

  const conj = w?.conjugations;
  if (typeof conj !== "object" || conj === null || Object.keys(conj).length === 0) {
    err(`"conjugations" rỗng — từ sẽ không luyện được`);
    continue;
  }
  for (const [tense, data] of Object.entries(conj)) {
    const e = (m) => errors.push(`[${id}.${tense}] ${m}`);
    const wn = (m) => warnings.push(`[${id}.${tense}] ${m}`);
    if (!TENSES.includes(tense)) {
      e(`key thì không hợp lệ (hợp lệ: ${TENSES.join(", ")})`);
      continue;
    }
    if (!data?.rule_vi) wn(`thiếu "rule_vi"`);

    // forms: đủ 6 đại từ, không rỗng
    const forms = data?.forms ?? {};
    for (const p of PRONOUNS) {
      if (typeof forms[p] !== "string" || !forms[p].trim()) e(`forms thiếu ngôi "${p}"`);
    }
    const extra = Object.keys(forms).filter((k) => !PRONOUNS.includes(k));
    if (extra.length) e(`forms có key lạ: ${extra.join(", ")}`);

    // alt phải trỏ vào ngôi hợp lệ và là mảng string
    for (const [p, alts] of Object.entries(data?.alt ?? {})) {
      if (!PRONOUNS.includes(p)) e(`alt có key lạ "${p}"`);
      else if (!Array.isArray(alts) || alts.some((a) => typeof a !== "string")) e(`alt["${p}"] phải là mảng string`);
    }

    if (!Array.isArray(data?.examples) || data.examples.length === 0) wn(`không có example nào`);
    for (const [i, ex] of (data?.examples ?? []).entries()) {
      if (!ex?.fr || !ex?.vi) e(`examples[${i}] thiếu fr hoặc vi`);
    }

    if (!Array.isArray(data?.cloze) || data.cloze.length === 0) {
      wn(`không có cloze — Level 2 của thì này sẽ không mở được`);
      continue;
    }
    const accepted = new Set([
      ...Object.values(forms),
      ...Object.values(data?.alt ?? {}).flat(),
    ]);
    for (const [i, c] of data.cloze.entries()) {
      const ce = (m) => errors.push(`[${id}.${tense}.cloze[${i}]] ${m}`);
      for (const field of ["before", "answer", "hint", "explain_vi"]) {
        if (typeof c?.[field] !== "string" || !c[field].trim()) ce(`thiếu "${field}"`);
      }
      if (typeof c?.after !== "string") ce(`thiếu "after" (chuỗi rỗng cũng được nhưng phải có)`);
      // đáp án cloze phải khớp một dạng chia đã khai báo — chặn lỗi chính tả lệch nhau
      if (c?.answer && !accepted.has(c.answer)) {
        ce(`answer "${c.answer}" không khớp forms/alt của thì này`);
      }
      for (const a of c?.alt ?? []) {
        if (!accepted.has(a)) warnings.push(`[${id}.${tense}.cloze[${i}]] alt "${a}" không có trong forms/alt của thì này`);
      }
      if (c?.hint && w?.word && c.hint !== w.word) {
        warnings.push(`[${id}.${tense}.cloze[${i}]] hint "${c.hint}" khác word "${w.word}"`);
      }
    }
  }
}

console.log(`Đã kiểm tra ${words.length} từ.`);
if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} warning:`);
  for (const m of warnings) console.log("  - " + m);
}
if (errors.length) {
  console.error(`\n✖ ${errors.length} lỗi:`);
  for (const m of errors) console.error("  - " + m);
  process.exit(1);
}
console.log("\n✔ Đạt — sẵn sàng import.");
