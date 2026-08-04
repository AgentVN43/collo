import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * POST /api/words/import
 * Header:  x-api-key: <IMPORT_API_KEY>
 * Body:    một object hoặc mảng object, gom theo Ý ĐỊNH GIAO TIẾP:
 *
 * {
 *   "intent": "báo dự án đang chậm tiến độ",
 *   "description_vi": "Khi tiến độ thực tế chậm hơn kế hoạch…",
 *   "situation": "quản lý dự án",
 *   "status": "draft",
 *   "collocations": [{
 *     "chunk": "fall behind schedule",
 *     "register": "formal",                 // formal | casual
 *     "category": "verb-preposition",       // 7 slug chuẩn, hoặc "other"
 *     "literal_meaning": "rơi vào tình trạng chậm tiến độ",
 *     "note_vi": "…",
 *     "examples": [{ "en": "…", "vi": "…", "pattern": "S+V+O" }],
 *     "conversation": [{ "speaker": "A", "text": "…(tiếng Anh)", "translate": "…(tiếng Việt)" }],
 *     "words": [{ "word": "schedule", "word_type": "n.", "meaning_vi": "…",
 *                 "meaning_en": "…", "basics_vi": "…" }],
 *     "exercises": [{ "type": "fill_in", "answer": "…", "explain_vi": "…",
 *                     "payload": { "before": "…", "after": "…" } }]
 *   }]
 * }
 *
 * Upsert `intents` theo `name_vi`, `collocations` theo `chunk`, `words` theo `word`.
 * Conversation nằm ngay trên collocation (mỗi cách nói tự minh hoạ). Exercises của mỗi
 * collocation/từ được THAY THẾ TOÀN BỘ nên gửi lại nhiều lần vẫn ra cùng kết quả.
 *
 * "words" có thể chỉ ghi tên (chuỗi) nếu chưa có nghĩa — khi đó từ được tạo ở trạng thái
 * draft để bổ sung sau.
 */

const STATUSES = ["draft", "processing", "published", "archived"];
const EXERCISE_TYPES = ["fill_in", "multiple_choice", "conversation_gap"];
const REGISTERS = ["formal", "casual"];

type Raw = Record<string, unknown>;

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

interface ParsedExercise {
  type: string;
  prompt: string;
  answer: string;
  alt: string[];
  explain_vi: string;
  pattern: string;
  payload: Raw;
  sort_order: number;
}

interface ParsedWord {
  word: string;
  word_type: string;
  meaning_vi: string;
  meaning_en: string;
  basics_vi: string;
  status: string;
  /** true = chỉ có tên, chưa có nội dung → chỉ tạo mới, không đè lên bản đã có */
  stub: boolean;
  exercises: ParsedExercise[];
}

interface ParsedCollocation {
  chunk: string;
  literal_meaning: string;
  category_slug: string;
  register: string;
  note_vi: string;
  examples: Raw[];
  conversation: { speaker: string; text: string; translate: string }[];
  status: string;
  words: ParsedWord[];
  exercises: ParsedExercise[];
}

interface ParsedIntent {
  name_vi: string;
  description_vi: string;
  situation: string;
  status: string;
  collocations: ParsedCollocation[];
}

function parseExercises(raw: unknown, where: string, errors: string[]): ParsedExercise[] {
  return arr(raw).map((e, i) => {
    const type = str(e.type);
    if (!EXERCISE_TYPES.includes(type)) {
      errors.push(`${where}.exercises[${i}]: "type" phải là ${EXERCISE_TYPES.join(" | ")}`);
    }
    if (!str(e.answer).trim()) errors.push(`${where}.exercises[${i}]: thiếu "answer"`);
    if (type === "multiple_choice") {
      const options = strArr((e.payload as Raw | undefined)?.options);
      if (options.length < 2) {
        errors.push(`${where}.exercises[${i}]: multiple_choice cần payload.options ≥ 2 lựa chọn`);
      } else if (!options.includes(str(e.answer))) {
        errors.push(`${where}.exercises[${i}]: "answer" phải nằm trong payload.options`);
      }
    }
    return {
      type,
      prompt: str(e.prompt),
      answer: str(e.answer),
      alt: strArr(e.alt),
      explain_vi: str(e.explain_vi),
      pattern: str(e.pattern),
      payload: typeof e.payload === "object" && e.payload !== null ? (e.payload as Raw) : {},
      sort_order: i,
    };
  });
}

/** Từ đơn: chấp nhận cả chuỗi tên lẫn object đầy đủ. */
function parseWords(raw: unknown, where: string, status: string, errors: string[]): ParsedWord[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    if (typeof item === "string") {
      const name = item.trim().toLowerCase();
      if (!name) errors.push(`${where}.words[${i}]: tên từ rỗng`);
      return {
        word: name,
        word_type: "n.",
        meaning_vi: "",
        meaning_en: "",
        basics_vi: "",
        status: "draft",
        stub: true,
        exercises: [],
      };
    }
    const w = (item ?? {}) as Raw;
    const name = str(w.word).trim().toLowerCase();
    if (!name) errors.push(`${where}.words[${i}]: thiếu "word"`);
    return {
      word: name,
      word_type: str(w.word_type, "n."),
      meaning_vi: str(w.meaning_vi),
      meaning_en: str(w.meaning_en),
      basics_vi: str(w.basics_vi),
      status: str(w.status, status),
      stub: false,
      exercises: parseExercises(w.exercises, `${where}.words[${i}]`, errors),
    };
  });
}

function parseItem(raw: Raw, index: number, errors: string[]): ParsedIntent {
  const where = `items[${index}]`;
  if (!str(raw.intent).trim()) errors.push(`${where}: thiếu "intent"`);
  const status = str(raw.status, "draft");
  if (!STATUSES.includes(status)) {
    errors.push(`${where}: "status" phải là ${STATUSES.join(" | ")}`);
  }

  const collocations = arr(raw.collocations).map((c, ci) => {
    const cw = `${where}.collocations[${ci}]`;
    if (!str(c.chunk).trim()) errors.push(`${cw}: thiếu "chunk"`);
    if (!str(c.category).trim()) {
      errors.push(`${cw}: thiếu "category" (7 slug chuẩn hoặc "other")`);
    }
    const register = str(c.register, "formal");
    if (!REGISTERS.includes(register)) {
      errors.push(`${cw}: "register" phải là ${REGISTERS.join(" | ")}`);
    }
    const cStatus = str(c.status, status);
    if (!STATUSES.includes(cStatus)) {
      errors.push(`${cw}: "status" phải là ${STATUSES.join(" | ")}`);
    }

    // text = lời thoại tiếng Anh; translate = bản dịch tiếng Việt (hiện khi người học mở)
    const conversation = arr(c.conversation).map((t, ti) => {
      if (!str(t.speaker).trim() || !str(t.text).trim()) {
        errors.push(`${cw}.conversation[${ti}]: cần cả "speaker" và "text"`);
      }
      return { speaker: str(t.speaker), text: str(t.text), translate: str(t.translate) };
    });

    const words = parseWords(c.words, cw, cStatus, errors);
    if (words.length === 0) errors.push(`${cw}: "words" rỗng — cần ít nhất 1 từ đơn cấu thành`);

    return {
      chunk: str(c.chunk).trim().toLowerCase(),
      literal_meaning: str(c.literal_meaning),
      category_slug: str(c.category).trim(),
      register,
      note_vi: str(c.note_vi),
      examples: arr(c.examples),
      conversation,
      status: cStatus,
      words,
      exercises: parseExercises(c.exercises, cw, errors),
    };
  });

  if (collocations.length === 0) {
    errors.push(`${where}: "collocations" rỗng — mỗi ý định cần ít nhất 1 cách nói`);
  }

  return {
    name_vi: str(raw.intent).trim(),
    description_vi: str(raw.description_vi),
    situation: str(raw.situation),
    status,
    collocations,
  };
}

/** Upsert từ đơn: bản đầy đủ ghi đè nội dung, bản stub chỉ tạo mới. */
async function upsertWords(
  db: SupabaseClient,
  words: ParsedWord[]
): Promise<{ ids: Map<string, string>; created: string[] } | { error: string }> {
  const full = new Map<string, ParsedWord>();
  const stubs = new Set<string>();
  for (const w of words) {
    if (!w.word) continue;
    if (w.stub) {
      if (!full.has(w.word)) stubs.add(w.word);
    } else {
      full.set(w.word, w);
      stubs.delete(w.word);
    }
  }

  // PostgREST bắt mọi object trong 1 bulk upsert phải CÙNG bộ key (PGRST102) →
  // bản đầy đủ và bản stub phải đi hai lệnh riêng.
  if (full.size > 0) {
    const { error } = await db.from("words").upsert(
      [...full.values()].map((w) => ({
        word: w.word,
        word_type: w.word_type,
        meaning_vi: w.meaning_vi,
        meaning_en: w.meaning_en,
        basics_vi: w.basics_vi,
        status: w.status,
      })),
      { onConflict: "word" }
    );
    if (error) return { error: error.message };
  }

  let created: string[] = [];
  if (stubs.size > 0) {
    const names = [...stubs];
    const { data: existing, error: exErr } = await db.from("words").select("word").in("word", names);
    if (exErr) return { error: exErr.message };
    const known = new Set((existing ?? []).map((r) => r.word as string));
    created = names.filter((n) => !known.has(n));
    if (created.length > 0) {
      const { error } = await db
        .from("words")
        .insert(created.map((word) => ({ word, status: "draft" })));
      if (error) return { error: error.message };
    }
  }

  const allNames = [...new Set([...full.keys(), ...stubs])];
  if (allNames.length === 0) return { ids: new Map(), created };
  const { data, error } = await db.from("words").select("id, word").in("word", allNames);
  if (error) return { error: error.message };
  return { ids: new Map((data ?? []).map((r) => [r.word as string, r.id as string])), created };
}

/** Xoá rồi chèn lại exercises của một chủ thể — gửi lại nhiều lần vẫn ra cùng kết quả. */
async function replaceExercises(
  db: SupabaseClient,
  column: "word_id" | "collocation_id",
  ownerId: string,
  exercises: ParsedExercise[]
): Promise<string | null> {
  const { error: delErr } = await db.from("exercises").delete().eq(column, ownerId);
  if (delErr) return delErr.message;
  if (exercises.length === 0) return null;
  const { error } = await db
    .from("exercises")
    .insert(exercises.map((e) => ({ ...e, [column]: ownerId })));
  return error ? error.message : null;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.IMPORT_API_KEY;
  if (!apiKey || req.headers.get("x-api-key") !== apiKey) {
    return NextResponse.json({ error: "Sai hoặc thiếu x-api-key" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Server chưa cấu hình Supabase" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body không phải JSON hợp lệ" }, { status: 400 });
  }

  const errors: string[] = [];
  const items = (Array.isArray(body) ? body : [body]).map((raw, i) =>
    parseItem(raw as Raw, i, errors)
  );
  if (errors.length > 0) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ", details: errors }, { status: 400 });
  }

  const db = createClient(url, serviceKey);
  const allCollocations = items.flatMap((it) => it.collocations);

  // Slug category phải tồn tại trước — chặn typo tạo nhóm rác
  const usedSlugs = [...new Set(allCollocations.map((c) => c.category_slug))];
  if (usedSlugs.length > 0) {
    const { data: known, error: catErr } = await db
      .from("categories")
      .select("slug")
      .in("slug", usedSlugs);
    if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });
    const knownSet = new Set((known ?? []).map((c) => c.slug));
    const unknown = usedSlugs.filter((s) => !knownSet.has(s));
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: `Category slug không tồn tại: ${unknown.join(", ")}. Dùng 1 trong 7 slug chuẩn hoặc "other".` },
        { status: 400 }
      );
    }
  }

  // 1. Ý định giao tiếp
  const { data: intentRows, error: intentErr } = await db
    .from("intents")
    .upsert(
      items.map((it) => ({
        name_vi: it.name_vi,
        description_vi: it.description_vi,
        situation: it.situation,
        status: it.status,
      })),
      { onConflict: "name_vi" }
    )
    .select("id, name_vi");
  if (intentErr) {
    return NextResponse.json({ error: `Ghi intents thất bại: ${intentErr.message}` }, { status: 500 });
  }
  const intentIds = new Map((intentRows ?? []).map((r) => [r.name_vi as string, r.id as string]));

  // 2. Từ đơn (gồm cả bản stub được tạo nháp)
  const wordResult = await upsertWords(db, allCollocations.flatMap((c) => c.words));
  if ("error" in wordResult) {
    return NextResponse.json({ error: `Ghi words thất bại: ${wordResult.error}` }, { status: 500 });
  }
  const { ids: wordIds, created: autoCreated } = wordResult;

  // 3. Collocations
  const { data: colRows, error: colErr } = await db
    .from("collocations")
    .upsert(
      items.flatMap((it) =>
        it.collocations.map((c) => ({
          chunk: c.chunk,
          literal_meaning: c.literal_meaning,
          category_slug: c.category_slug,
          intent_id: intentIds.get(it.name_vi) ?? null,
          register: c.register,
          note_vi: c.note_vi,
          examples: c.examples,
          conversation: c.conversation,
          status: c.status,
        }))
      ),
      { onConflict: "chunk" }
    )
    .select("id, chunk");
  if (colErr) {
    return NextResponse.json({ error: `Ghi collocations thất bại: ${colErr.message}` }, { status: 500 });
  }
  const collocationIds = new Map((colRows ?? []).map((r) => [r.chunk as string, r.id as string]));

  // 4. Liên kết từ đơn ↔ collocation, và bài tập của cả hai phía
  const doneWords = new Set<string>();
  for (const c of allCollocations) {
    const cid = collocationIds.get(c.chunk);
    if (!cid) continue;

    const linkIds = c.words.map((w) => wordIds.get(w.word)).filter(Boolean) as string[];
    if (linkIds.length > 0) {
      const { error } = await db.from("word_collocations").upsert(
        [...new Set(linkIds)].map((word_id) => ({ word_id, collocation_id: cid })),
        { onConflict: "word_id,collocation_id", ignoreDuplicates: true }
      );
      if (error) {
        return NextResponse.json(
          { error: `Liên kết "${c.chunk}" thất bại: ${error.message}` },
          { status: 500 }
        );
      }
    }

    const colExErr = await replaceExercises(db, "collocation_id", cid, c.exercises);
    if (colExErr) {
      return NextResponse.json(
        { error: `Ghi exercises của "${c.chunk}" thất bại: ${colExErr}` },
        { status: 500 }
      );
    }

    for (const w of c.words) {
      const wid = wordIds.get(w.word);
      // Từ xuất hiện ở nhiều collocation → chỉ xử lý bài tập một lần
      if (!wid || w.stub || doneWords.has(w.word)) continue;
      doneWords.add(w.word);
      const wordExErr = await replaceExercises(db, "word_id", wid, w.exercises);
      if (wordExErr) {
        return NextResponse.json(
          { error: `Ghi exercises của từ "${w.word}" thất bại: ${wordExErr}` },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    intents: items.length,
    collocations: allCollocations.length,
    words: wordIds.size,
    auto_created_words: autoCreated, // từ chỉ có tên, tạo nháp — cần bổ sung nghĩa
  });
}
