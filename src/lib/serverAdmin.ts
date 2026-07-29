// Server-only: service role client + kiểm tra quyền admin cho các API route AI Center.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface AdminAuth {
  ok: true;
  email: string;
  admin: SupabaseClient;
}
export interface AdminAuthError {
  ok: false;
  status: number;
  error: string;
}

/**
 * Xác thực request từ Admin UI: Bearer token của user → verify qua Supabase →
 * đối chiếu email với bảng admins bằng service role.
 */
export async function requireAdmin(req: NextRequest): Promise<AdminAuth | AdminAuthError> {
  const admin = serviceClient();
  if (!admin) return { ok: false, status: 500, error: "Server chưa cấu hình Supabase" };

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401, error: "Thiếu Bearer token" };

  const { data, error } = await admin.auth.getUser(token);
  const email = data?.user?.email;
  if (error || !email) return { ok: false, status: 401, error: "Token không hợp lệ" };

  const { data: row } = await admin.from("admins").select("email").eq("email", email).maybeSingle();
  if (!row) return { ok: false, status: 403, error: "Không có quyền quản trị" };

  return { ok: true, email, admin };
}
