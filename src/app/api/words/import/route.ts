import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * POST /api/words/import
 * Header:  x-api-key: <IMPORT_API_KEY>
 * Body:    một object hoặc mảng object theo shape dưới đây.
 *
 * {
 *   "word": "pain", "word_type": "n.",
 *   "meaning_vi": "cơn đau", "meaning_en": "…", "basics_vi": "…", "status": "draft",
 *   "exercises": [ … ],                      // bài tập cho chính TỪ ĐƠN (Level 1) — tuỳ chọn
 *   "collocations": [{
 *     "chunk": "excruciating pain",
 *     "literal_meaning": "cơn đau dữ dội",
 *     "category": "adjective-noun",          // 1 trong 7 slug ở bảng categories
 *     "note_vi": "…",
 *     "examples": [{ "en": "…", "vi": "…", "pattern": "S+V+C" }],
 *     "also_words": ["excruciating"],        // từ đơn khác cùng tạo nên cụm này
 *     "variants": [{ "context": "formal", "text_variant": "…",
 *                    "conversation": [{ "speaker": "A", "text": "…" }] }],
 *     "exercises": [{ "type": "fill_in", "prompt": "…", "answer": "…", "alt": [],
 *                     "explain_vi": "…", "pattern": "S+V+C",
 *                     "payload": { "before": "…", "after": "…" } }]
 *   }]
 * }
 *
 * Upsert `words` theo cột `word`, `collocations` theo cột `chunk`. Variants và exercises của
 * mỗi collocation được THAY THẾ TOÀN BỘ (xoá cũ rồi chèn mới) — gửi lại bao nhiêu lần cũng
 * ra cùng kết quả. Từ trong `also_words` chưa có sẵn sẽ được tự tạo ở trạng thái draft.
 */

const STATUSES = ["draft", "processing", "published", "archived"];
const EXERCISE_TYPES = ["fill_in", "multiple_choice", "conversation_gap"];
const VARIANT_CONTEXTS = ["casual", "formal", "alternative"];

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

interface ParsedVariant {
  context: string;
  text_variant: string;
  conversation: { speaker: string; text: string }[];
  sort_order: number;
}

interface ParsedCollocation {
  chunk: string;
  literal_meaning: string;
  category_slug: string;
  note_vi: string;
  examples: Raw[];
  status: string;
  also_words: string[];
  variants: ParsedVariant[];
  exercises: ParsedExercise[];
}

interface ParsedWord {
  word: string;
  word_type: string;
  meaning_vi: string;
  meaning_en: string;
  basics_vi: string;
  status: string;
  exercises: ParsedExercise[];
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

function parseItem(raw: Raw, index: number, errors: string[]): ParsedWord {
  const where = `items[${index}]`;
  if (!str(raw.word).trim()) errors.push(`${where}: thiếu "word"`);
  const status = str(raw.status, "draft");
  if (!STATUSES.includes(status)) {
    errors.push(`${where}: "status" phải là ${STATUSES.join(" | ")}`);
  }

  const collocations = arr(raw.collocations).map((c, ci) => {
    const cw = `${where}.collocations[${ci}]`;
    if (!str(c.chunk).trim()) errors.push(`${cw}: thiếu "chunk"`);
    if (!str(c.category).trim()) {
      errors.push(`${cw}: thiếu "category" (slug loại collocation, vd "verb-noun")`);
    }
    const cStatus = str(c.status, status);
    if (!STATUSES.includes(cStatus)) {
      errors.push(`${cw}: "status" phải là ${STATUSES.join(" | ")}`);
    }

    const variants = arr(c.variants).map((v, vi) => {
      const context = str(v.context);
      if (!VARIANT_CONTEXTS.includes(context)) {
        errors.push(`${cw}.variants[${vi}]: "context" phải là ${VARIANT_CONTEXTS.join(" | ")}`);
      }
      const conversation = arr(v.conversation).map((t, ti) => {
        if (!str(t.speaker).trim() || !str(t.text).trim()) {
          errors.push(`${cw}.variants[${vi}].conversation[${ti}]: cần cả "speaker" và "text"`);
        }
        return { speaker: str(t.speaker), text: str(t.text) };
      });
      return { context, text_variant: str(v.text_variant), conversation, sort_order: vi };
    });

    return {
      chunk: str(c.chunk).trim().toLowerCase(),
      literal_meaning: str(c.literal_meaning),
      category_slug: str(c.category).trim(),
      note_vi: str(c.note_vi),
      examples: arr(c.examples),
      status: cStatus,
      also_words: strArr(c.also_words).map((w) => w.trim().toLowerCase()).filter(Boolean),
      variants,
      exercises: parseExercises(c.exercises, cw, errors),
    };
  });

  return {
    word: str(raw.word).trim().toLowerCase(),
    word_type: str(raw.word_type, "n."),
    meaning_vi: str(raw.meaning_vi),
    meaning_en: str(raw.meaning_en),
    basics_vi: str(raw.basics_vi),
    status,
    exercises: parseExercises(raw.exercises, where, errors),
    collocations,
  };
}

/** Upsert nhiều từ đơn theo tên, trả map word -> id. Từ chỉ có tên được tạo ở draft. */
async function upsertWords(
  db: SupabaseClient,
  full: ParsedWord[],
  extraNames: string[]
): Promise<{ ids: Map<string, string>; created: string[] } | { error: string }> {
  const fullNames = [...new Set(full.map((w) => w.word))];
  const stubNames = [...new Set(extraNames)].filter((n) => !fullNames.includes(n));

  // PostgREST bắt mọi object trong 1 bulk upsert phải CÙNG bộ key (PGRST102) — nên từ đầy đủ
  // và từ stub phải đi thành hai lệnh riêng, không gộp chung mảng.

  // 1. Từ có nội dung đầy đủ → upsert (đè nội dung mới lên bản cũ)
  if (full.length > 0) {
    const { error } = await db.from("words").upsert(
      full.map((w) => ({
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

  // 2. Từ chỉ được nhắc trong also_words → CHỈ tạo mới, không đè lên bản đã có
  let created: string[] = [];
  if (stubNames.length > 0) {
    const { data: existing, error: exErr } = await db
      .from("words")
      .select("word")
      .in("word", stubNames);
    if (exErr) return { error: exErr.message };
    const known = new Set((existing ?? []).map((r) => r.word as string));
    created = stubNames.filter((n) => !known.has(n));
    if (created.length > 0) {
      const { error } = await db
        .from("words")
        .insert(created.map((word) => ({ word, status: "draft" })));
      if (error) return { error: error.message };
    }
  }

  // 3. Lấy id của toàn bộ từ liên quan (gồm cả bản đã có sẵn từ trước)
  const allNames = [...fullNames, ...stubNames];
  if (allNames.length === 0) return { ids: new Map(), created };
  const { data, error } = await db.from("words").select("id, word").in("word", allNames);
  if (error) return { error: error.message };

  return {
    ids: new Map((data ?? []).map((r) => [r.word as string, r.id as string])),
    created,
  };
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
  const allCollocations = items.flatMap((w) => w.collocations);

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
        { error: `Category slug không tồn tại: ${unknown.join(", ")}. Thêm vào bảng categories trước.` },
        { status: 400 }
      );
    }
  }

  // 1. Từ đơn (gồm cả also_words được tự tạo nháp)
  const wordResult = await upsertWords(
    db,
    items,
    allCollocations.flatMap((c) => c.also_words)
  );
  if ("error" in wordResult) {
    return NextResponse.json({ error: `Ghi words thất bại: ${wordResult.error}` }, { status: 500 });
  }
  const { ids: wordIds, created: autoCreated } = wordResult;

  // 2. Bài tập cấp từ đơn — thay thế toàn bộ
  for (const w of items) {
    const wordId = wordIds.get(w.word);
    if (!wordId) continue;
    await db.from("exercises").delete().eq("word_id", wordId);
    if (w.exercises.length > 0) {
      const { error } = await db
        .from("exercises")
        .insert(w.exercises.map((e) => ({ ...e, word_id: wordId })));
      if (error) {
        return NextResponse.json(
          { error: `Ghi exercises của "${w.word}" thất bại: ${error.message}` },
          { status: 500 }
        );
      }
    }
  }

  // 3. Collocations
  let collocationIds = new Map<string, string>();
  if (allCollocations.length > 0) {
    const { data, error } = await db
      .from("collocations")
      .upsert(
        allCollocations.map((c) => ({
          chunk: c.chunk,
          literal_meaning: c.literal_meaning,
          category_slug: c.category_slug,
          note_vi: c.note_vi,
          examples: c.examples,
          status: c.status,
        })),
        { onConflict: "chunk" }
      )
      .select("id, chunk");
    if (error) {
      return NextResponse.json({ error: `Ghi collocations thất bại: ${error.message}` }, { status: 500 });
    }
    collocationIds = new Map((data ?? []).map((r) => [r.chunk as string, r.id as string]));
  }

  // 4. Liên kết nhiều-nhiều + variants + exercises của từng collocation
  for (const w of items) {
    const ownerId = wordIds.get(w.word);
    for (const c of w.collocations) {
      const cid = collocationIds.get(c.chunk);
      if (!cid) continue;

      const linkedWordIds = new Set<string>();
      if (ownerId) linkedWordIds.add(ownerId);
      for (const name of c.also_words) {
        const id = wordIds.get(name);
        if (id) linkedWordIds.add(id);
      }
      if (linkedWordIds.size > 0) {
        const { error } = await db.from("word_collocations").upsert(
          [...linkedWordIds].map((word_id) => ({ word_id, collocation_id: cid })),
          { onConflict: "word_id,collocation_id", ignoreDuplicates: true }
        );
        if (error) {
          return NextResponse.json(
            { error: `Liên kết "${c.chunk}" thất bại: ${error.message}` },
            { status: 500 }
          );
        }
      }

      // Thay thế toàn bộ variants + exercises (gửi lại nhiều lần vẫn ra cùng kết quả)
      await db.from("collocation_variants").delete().eq("collocation_id", cid);
      if (c.variants.length > 0) {
        const { error } = await db
          .from("collocation_variants")
          .insert(c.variants.map((v) => ({ ...v, collocation_id: cid })));
        if (error) {
          return NextResponse.json(
            { error: `Ghi variants của "${c.chunk}" thất bại: ${error.message}` },
            { status: 500 }
          );
        }
      }

      await db.from("exercises").delete().eq("collocation_id", cid);
      if (c.exercises.length > 0) {
        const { error } = await db
          .from("exercises")
          .insert(c.exercises.map((e) => ({ ...e, collocation_id: cid })));
        if (error) {
          return NextResponse.json(
            { error: `Ghi exercises của "${c.chunk}" thất bại: ${error.message}` },
            { status: 500 }
          );
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    words: items.length,
    collocations: allCollocations.length,
    auto_created_words: autoCreated, // từ trong also_words được tạo nháp, cần bổ sung nghĩa
  });
}
