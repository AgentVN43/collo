// Parse file RTF export từ Le Conjugueur (leconjugueur.lefigaro.fr) thành skeleton JSON.
// Forms được trích NGUYÊN VĂN từ nguồn chuẩn — không suy luận. AI chỉ điền phần còn trống
// (meaning, basics_vi, rule_vi, examples, cloze) và KHÔNG được sửa forms/alt/category.
//
//   node scripts/parse-conjugueur.mjs <file.rtf | thư-mục> [...] [-o content/skeleton.json]
//
// Futur proche không có trong nguồn nhưng cấu tạo máy móc (aller présent + nguyên mẫu)
// nên được sinh tự động. Động từ đi với être ở thì kép: form theo nguồn (giống đực),
// tự sinh alt hợp giống; riêng dòng "elles" chuyển sang giống cái theo convention của app.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const TENSE_MAP = {
  "Indicatif|Présent": "present",
  "Indicatif|Imparfait": "imparfait",
  "Indicatif|Passé simple": "passe_simple",
  "Indicatif|Futur simple": "futur_simple",
  "Indicatif|Passé composé": "passe_compose",
  "Indicatif|Plus-que-parfait": "plus_que_parfait",
  "Indicatif|Passé antérieur": "passe_anterieur",
  "Indicatif|Futur antérieur": "futur_anterieur",
  "Subjonctif|Présent": "subj_present",
  "Subjonctif|Passé": "subj_passe",
  "Subjonctif|Imparfait": "subj_imparfait",
  "Subjonctif|Plus-que-parfait": "subj_plus_que_parfait",
  "Conditionnel|Présent": "cond_present",
  "Conditionnel|Passé première forme": "cond_passe",
};
const SECTIONS = ["Indicatif", "Subjonctif", "Conditionnel", "Impératif", "Infinitif", "Participe", "Gérondif"];
const HEADERS = [...new Set(Object.keys(TENSE_MAP).map((k) => k.split("|")[1])), "Passé deuxième forme", "Passé"];
const PRONOUN_KEYS = ["j", "tu", "il_elle", "nous", "vous", "elles"];
const COMPOUND_TENSES = new Set([
  "passe_compose", "plus_que_parfait", "passe_anterieur", "futur_anterieur",
  "subj_passe", "subj_plus_que_parfait", "cond_passe",
]);

// ---- RTF → text ----
function stripGroup(rtf, marker) {
  let out = rtf;
  let i;
  while ((i = out.indexOf(marker)) !== -1) {
    let depth = 0;
    let j = i;
    for (; j < out.length; j++) {
      if (out[j] === "{") depth++;
      else if (out[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    out = out.slice(0, i) + out.slice(j + 1);
  }
  return out;
}

function rtfToCells(raw) {
  let s = raw;
  for (const m of ["{\\*\\shppict", "{\\pict", "{\\fonttbl", "{\\colortbl", "{\\info", "{\\*\\blipuid"]) {
    s = stripGroup(s, m);
  }
  s = s
    .replace(/\\par\b/g, "\n")
    .replace(/\\cell\b/g, "\x07")
    .replace(/\\row\b/g, "")
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, h) => Buffer.from([parseInt(h, 16)]).toString("latin1"))
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, "")
    .replace(/[{}]/g, "");
  return s.split("\x07").map((c) => c.replace(/[ \t]+/g, " ").trim());
}

// ---- Bóc đại từ chủ ngữ (giữ lại đại từ phản thân) ----
function stripSubject(line) {
  return line
    .trim()
    .replace(/^qu['’]\s?/i, "")
    .replace(/^que\s+/i, "")
    .replace(/^(je|tu|il|elle|on|nous|vous|ils|elles)\s+/i, "")
    .replace(/^j['’]\s?/i, "")
    .trim();
}

// Dòng "nous nous levons": bỏ chủ ngữ "nous", giữ đại từ phản thân "nous levons" —
// stripSubject chỉ bỏ token đầu nên tự đúng. "j'ai" → "ai". "qu'il eût" → "eût".

function parseBodyCell(cell) {
  const lines = cell.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length !== 6) return null;
  const forms = {};
  lines.forEach((line, i) => (forms[PRONOUN_KEYS[i]] = stripSubject(line)));
  return forms;
}

/** Thì kép với être: nguồn cho giống đực → sinh alt hợp giống, elles chuyển giống cái. */
function applyEtreAgreement(forms) {
  const pp = forms.il_elle.split(" ").pop(); // participe passé giống đực số ít
  const auxOf = (f) => f.slice(0, f.length - pp.length).trimEnd();
  // Nguồn cho "ils sont allés" → dòng elles của app dùng giống cái: "sont allées"
  const ellesAux = forms.elles.replace(new RegExp(`\\s*${pp}s?$`), "");
  const out = { ...forms, elles: `${ellesAux} ${pp}es` };
  const alt = {
    j: [`${auxOf(forms.j)} ${pp}e`],
    tu: [`${auxOf(forms.tu)} ${pp}e`],
    il_elle: [`${auxOf(forms.il_elle)} ${pp}e`],
    nous: [`${auxOf(forms.nous)} ${pp}es`],
    vous: [
      forms.vous.replace(new RegExp(`${pp}s?$`), pp),
      forms.vous.replace(new RegExp(`${pp}s?$`), pp + "e"),
      forms.vous.replace(new RegExp(`${pp}s?$`), pp + "es"),
    ],
    elles: [`${ellesAux} ${pp}s`], // chấp nhận cả dạng ils (giống đực số nhiều)
  };
  return { forms: out, alt };
}

/** Futur proche = aller présent + nguyên mẫu (sinh máy móc, không cần nguồn). */
function futurProche(infinitive) {
  const ALLER = ["vais", "vas", "va", "allons", "allez", "vont"];
  const REFLEX = ["me", "te", "se", "nous", "vous", "se"];
  const isReflexive = /^s(e |')/i.test(infinitive);
  const base = infinitive.replace(/^s(e |')/i, "");
  const forms = {};
  PRONOUN_KEYS.forEach((p, i) => {
    if (isReflexive) {
      const r = /^[aeiouéèêh]/i.test(base) && ["me", "te", "se"].includes(REFLEX[i])
        ? REFLEX[i][0] + "'"
        : REFLEX[i] + " ";
      forms[p] = `${ALLER[i]} ${r}${base}`.replace("' ", "'");
    } else {
      forms[p] = `${ALLER[i]} ${infinitive}`;
    }
  });
  return forms;
}

function parseRtfFile(path) {
  const raw = readFileSync(path, "latin1");
  // Lấy tên động từ từ metadata trước khi strip group info
  const subjectMatch = raw.match(/\{\\subject verbe ([^}]+)\}/);
  const cells = rtfToCells(raw);
  const fullText = cells.join(" ");

  const infinitive = (subjectMatch?.[1] ?? "")
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, h) => Buffer.from([parseInt(h, 16)]).toString("latin1"))
    .trim()
    .toLowerCase();
  if (!infinitive) throw new Error(`${path}: không tìm thấy tên động từ trong metadata RTF`);

  // Nhóm động từ từ nguồn → category
  const groupMatch = fullText.match(/(Premier|Deuxième|Troisième) groupe/i);
  const category = groupMatch
    ? { premier: "nhom-er", deuxième: "nhom-ir", troisième: "nhom-3" }[groupMatch[1].toLowerCase()]
    : "nhom-3";

  // Quét cell: section → hàng đợi header → body gán theo thứ tự FIFO
  let section = "";
  let pendingHeaders = [];
  const conjugations = {};
  let auxEtre = false;

  for (const cell of cells) {
    if (!cell) continue;
    const clean = cell.replace(/\s+/g, " ").trim();
    // Cell đầu file có thể dính cả tiêu đề ("brandir Deuxième groupe … Indicatif")
    const sec = SECTIONS.find((s) => clean === s || clean.endsWith(" " + s));
    if (sec) {
      section = sec;
      pendingHeaders = [];
      continue;
    }
    if (HEADERS.includes(clean)) {
      pendingHeaders.push(clean);
      continue;
    }
    const forms = parseBodyCell(cell);
    if (forms && pendingHeaders.length > 0) {
      const header = pendingHeaders.shift();
      const tense = TENSE_MAP[`${section}|${header}`];
      if (!tense) continue;
      if (tense === "passe_compose" && /^(suis|es|est|me suis|t'es|s'est)\b/.test(forms.j + " ")) {
        auxEtre = true;
      }
      conjugations[tense] = { forms };
    }
  }

  // Hợp giống cho thì kép của động từ đi với être / phản thân
  const etre = auxEtre || /^s(e |')/i.test(infinitive);
  for (const [tense, data] of Object.entries(conjugations)) {
    if (etre && COMPOUND_TENSES.has(tense)) {
      const withAgreement = applyEtreAgreement(data.forms);
      conjugations[tense] = withAgreement;
    }
  }

  conjugations.futur_proche = { forms: futurProche(infinitive) };

  // Skeleton: AI điền các field rỗng, KHÔNG sửa word/category/forms/alt
  const ordered = {};
  for (const key of [
    "present", "passe_compose", "futur_proche", "imparfait", "futur_simple",
    "plus_que_parfait", "futur_anterieur", "passe_simple", "passe_anterieur",
    "subj_present", "subj_passe", "subj_imparfait", "subj_plus_que_parfait",
    "cond_present", "cond_passe",
  ]) {
    if (!conjugations[key]) continue;
    ordered[key] = {
      rule_vi: "",
      forms: conjugations[key].forms,
      ...(conjugations[key].alt ? { alt: conjugations[key].alt } : {}),
      examples: [],
      cloze: [],
    };
  }

  return {
    word: infinitive,
    word_type: "v.",
    category,
    meaning_vi: "",
    meaning_en: "",
    basics_vi: "",
    conjugations: ordered,
  };
}

// ---- CLI ----
const args = process.argv.slice(2);
const outIdx = args.indexOf("-o");
const outFile = outIdx !== -1 ? args[outIdx + 1] : null;
const inputs = outIdx === -1 ? args : args.filter((_, i) => i !== outIdx && i !== outIdx + 1);

if (inputs.length === 0) {
  console.error("Cách dùng: node scripts/parse-conjugueur.mjs <file.rtf | thư-mục> [-o content/out.json]");
  process.exit(1);
}

const files = [];
for (const input of inputs) {
  const p = resolve(input);
  if (statSync(p).isDirectory()) {
    for (const f of readdirSync(p)) if (f.toLowerCase().endsWith(".rtf")) files.push(join(p, f));
  } else {
    files.push(p);
  }
}

const words = files.map((f) => {
  const w = parseRtfFile(f);
  console.error(`✔ ${w.word} (${w.category}) — ${Object.keys(w.conjugations).length} thì`);
  return w;
});

const json = JSON.stringify(words, null, 2);
if (outFile) {
  writeFileSync(resolve(outFile), json, "utf8");
  console.error(`\nĐã ghi ${words.length} từ → ${outFile}`);
} else {
  console.log(json);
}
