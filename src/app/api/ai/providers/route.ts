import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/serverAdmin";

export const runtime = "nodejs";

/** GET: danh sách provider (API key được che, chỉ báo có/chưa có). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.admin
    .from("ai_providers")
    .select("id, name, base_url, model, api_key, headers, created_at")
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const masked = (data ?? []).map(({ api_key, ...p }) => ({
    ...p,
    has_key: api_key.length > 0,
    key_hint: api_key ? `••••${api_key.slice(-4)}` : "",
  }));
  return NextResponse.json({ providers: masked });
}

/** POST: tạo/cập nhật provider. Không gửi api_key khi update → giữ key cũ. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || typeof body.base_url !== "string") {
    return NextResponse.json({ error: "Cần name và base_url" }, { status: 400 });
  }

  let headers: Record<string, string> = {};
  if (typeof body.headers === "string" && body.headers.trim()) {
    try {
      headers = JSON.parse(body.headers);
    } catch {
      return NextResponse.json({ error: "headers không phải JSON hợp lệ" }, { status: 400 });
    }
  } else if (typeof body.headers === "object" && body.headers !== null) {
    headers = body.headers as Record<string, string>;
  }

  const row: Record<string, unknown> = {
    name: body.name.trim(),
    base_url: body.base_url.trim(),
    model: typeof body.model === "string" ? body.model.trim() : "",
    headers,
  };
  if (typeof body.api_key === "string" && body.api_key.trim()) row.api_key = body.api_key.trim();

  if (typeof body.id === "string" && body.id) {
    const { error } = await auth.admin.from("ai_providers").update(row).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: body.id });
  }
  const { data, error } = await auth.admin
    .from("ai_providers")
    .insert({ ...row, api_key: row.api_key ?? "" })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

/** DELETE: xóa provider (task trỏ tới sẽ bị xóa theo cascade). */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  const { error } = await auth.admin.from("ai_providers").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
