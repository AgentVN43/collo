import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * POST /api/words/import
 * Header:  x-api-key: <IMPORT_API_KEY>
 * Body:    một word object hoặc mảng word objects:
 * {
 *   "word": "sync", "word_type": "v.",
 *   "category": "word-partnership",    // slug từ bảng categories — đúng 1 loại collocation
 *   "meaning_vi": "đồng bộ", "meaning_en": "to synchronize", "basics_vi": "...",
 *   "partnerships": [ { "key": "in_sync_with", "phrase": "in sync (with)", "meaning_vi": "...", "rule_vi": "...", "examples": [...], "cloze": [...] }, ... ]
 * }
 * Upsert theo cột `word`. Slug category phải tồn tại sẵn trong bảng `categories`.
 */
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

  const items = Array.isArray(body) ? body : [body];
  const errors: string[] = [];
  const rows = items.map((item, i) => {
    const w = item as Record<string, unknown>;
    if (typeof w?.word !== "string" || !w.word.trim()) errors.push(`items[${i}]: thiếu "word"`);
    if (typeof w?.meaning_vi !== "string") errors.push(`items[${i}]: thiếu "meaning_vi"`);
    if (typeof w?.meaning_en !== "string") errors.push(`items[${i}]: thiếu "meaning_en"`);
    if (typeof w?.category !== "string" || !w.category.trim())
      errors.push(`items[${i}]: thiếu "category" (slug loại collocation, vd "word-partnership")`);
    const status = typeof w?.status === "string" ? w.status : "published";
    if (!["draft", "processing", "published", "archived"].includes(status))
      errors.push(`items[${i}]: "status" phải là draft | processing | published | archived`);
    return {
      status,
      word: String(w?.word ?? "").trim().toLowerCase(),
      word_type: typeof w?.word_type === "string" ? w.word_type : "v.",
      category_slug: String(w?.category ?? "").trim(),
      meaning_vi: String(w?.meaning_vi ?? ""),
      meaning_en: String(w?.meaning_en ?? ""),
      basics_vi: typeof w?.basics_vi === "string" ? w.basics_vi : "",
      partnerships: Array.isArray(w?.partnerships) ? w.partnerships : [],
    };
  });

  if (errors.length > 0) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ", details: errors }, { status: 400 });
  }

  const admin = createClient(url, serviceKey);

  // Slug category phải tồn tại trước — chặn typo tạo nhóm rác
  const usedSlugs = [...new Set(rows.map((r) => r.category_slug))];
  const { data: known, error: catErr } = await admin
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

  const { error: upsertErr } = await admin.from("words").upsert(rows, { onConflict: "word" });
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, imported: rows.length });
}
