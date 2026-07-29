import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * POST /api/words/import-draft
 * Header:  x-api-key: <IMPORT_API_KEY>
 * Body:    { "word": "sync" } hoặc [{ "word": "sync" }, { "word": "resolve" }]
 *
 * Import nháp: chỉ cần `word`, status mặc định 'draft'.
 * Dùng để tạo bản ghi chưa hoàn thiện, sau đó update dần rồi publish.
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
    if (typeof w?.word !== "string" || !w.word.trim()) {
      errors.push(`items[${i}]: thiếu "word"`);
    }
    return {
      word: String(w?.word ?? "").trim().toLowerCase(),
      word_type: typeof w?.word_type === "string" ? w.word_type : "v.",
      category_slug: typeof w?.category === "string" && w.category.trim() ? w.category.trim() : null,
      meaning_vi: typeof w?.meaning_vi === "string" ? w.meaning_vi : "",
      meaning_en: typeof w?.meaning_en === "string" ? w.meaning_en : "",
      basics_vi: typeof w?.basics_vi === "string" ? w.basics_vi : "",
      partnerships: Array.isArray(w?.partnerships) ? w.partnerships : [],
      status: "draft", // endpoint này chỉ tạo/cập nhật nháp; publish qua /api/words/import
    };
  });

  if (errors.length > 0) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ", details: errors }, { status: 400 });
  }

  const admin = createClient(url, serviceKey);

  // Chỉ được đè lên từ đang draft — từ đã vào duyệt (processing) hoặc published thì từ chối
  const { data: existing, error: exErr } = await admin
    .from("words")
    .select("word, status")
    .in("word", rows.map((r) => r.word));
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
  const locked = (existing ?? []).filter((r) => r.status !== "draft");
  if (locked.length > 0) {
    return NextResponse.json(
      {
        error: `Từ không còn ở trạng thái draft, không được đè: ${locked
          .map((r) => `${r.word} (${r.status})`)
          .join(", ")}. Dùng /api/words/import để cập nhật.`,
      },
      { status: 409 }
    );
  }

  const { error: upsertErr } = await admin.from("words").upsert(rows, { onConflict: "word" });
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, imported: rows.length });
}
