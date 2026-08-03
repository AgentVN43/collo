"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WordStatus } from "./types";

/** Hai bảng nội dung dùng chung flow duyệt draft → processing → published. */
export type ContentTable = "words" | "collocations";

/** Cột định danh hiển thị trong danh sách admin của từng bảng. */
const LABEL_COLUMN: Record<ContentTable, string> = {
  words: "word",
  collocations: "chunk",
};

/** User hiện tại có trong bảng admins không (RLS chỉ cho đọc dòng email của chính mình). */
export async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.from("admins").select("email").limit(1);
  return (data ?? []).length > 0;
}

export interface AdminContentRow {
  id: string;
  label: string; // words.word hoặc collocations.chunk
  status: WordStatus;
  meaning: string; // words.meaning_vi hoặc collocations.literal_meaning
  created_at: string;
}

/** Đếm số bản ghi theo từng status (cho tab của Admin Dashboard). */
export async function adminStatusCounts(
  supabase: SupabaseClient,
  table: ContentTable
): Promise<Record<WordStatus, number>> {
  const { data } = await supabase.from(table).select("status");
  const counts: Record<WordStatus, number> = { draft: 0, processing: 0, published: 0, archived: 0 };
  for (const r of data ?? []) {
    const s = r.status as WordStatus;
    if (s in counts) counts[s]++;
  }
  return counts;
}

export async function adminListContent(
  supabase: SupabaseClient,
  table: ContentTable,
  status: WordStatus
): Promise<AdminContentRow[]> {
  const labelCol = LABEL_COLUMN[table];
  const meaningCol = table === "words" ? "meaning_vi" : "literal_meaning";
  // select() dựng động theo bảng → kiểu suy luận của PostgREST không dùng được, cast thủ công
  const { data } = await supabase
    .from(table)
    .select(`id, ${labelCol}, ${meaningCol}, status, created_at`)
    .eq("status", status)
    .order(labelCol);
  return ((data as unknown as Record<string, unknown>[]) ?? []).map((r) => ({
    id: String(r.id),
    label: String(r[labelCol] ?? ""),
    status: r.status as WordStatus,
    meaning: String(r[meaningCol] ?? ""),
    created_at: String(r.created_at ?? ""),
  }));
}

/** Tạo bản ghi nháp từ Admin UI (chỉ cần tên; nội dung điền sau hoặc qua import). */
export async function adminCreateContent(
  supabase: SupabaseClient,
  table: ContentTable,
  label: string
): Promise<{ id: string } | { error: string }> {
  const value = label.trim().toLowerCase();
  const payload: Record<string, string> =
    table === "words" ? { word: value, status: "draft" } : { chunk: value, status: "draft" };
  const { data, error } = await supabase.from(table).insert(payload).select("id").single();
  if (error) {
    return { error: error.code === "23505" ? `"${label}" đã tồn tại.` : error.message };
  }
  return { id: data.id };
}

export interface AdminWordPatch {
  status?: WordStatus;
  word_type?: string;
  meaning_vi?: string;
  meaning_en?: string;
  basics_vi?: string;
}

export interface AdminCollocationPatch {
  status?: WordStatus;
  category_slug?: string | null;
  literal_meaning?: string;
  note_vi?: string;
}

export async function adminUpdateContent(
  supabase: SupabaseClient,
  table: ContentTable,
  id: string,
  patch: AdminWordPatch | AdminCollocationPatch
): Promise<string | null> {
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  return error ? error.message : null;
}
