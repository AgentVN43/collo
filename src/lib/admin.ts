"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WordStatus } from "./types";

/** User hiện tại có trong bảng admins không (RLS chỉ cho đọc dòng email của chính mình). */
export async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.from("admins").select("email").limit(1);
  return (data ?? []).length > 0;
}

export interface AdminWordRow {
  id: string;
  word: string;
  status: WordStatus;
  category_slug: string | null;
  meaning_vi: string;
  created_at: string;
}

/** Đếm số từ theo từng status (cho tab của Admin Dashboard). */
export async function adminStatusCounts(
  supabase: SupabaseClient
): Promise<Record<WordStatus, number>> {
  const { data } = await supabase.from("words").select("status");
  const counts: Record<WordStatus, number> = { draft: 0, processing: 0, published: 0, archived: 0 };
  for (const r of data ?? []) {
    const s = r.status as WordStatus;
    if (s in counts) counts[s]++;
  }
  return counts;
}

export async function adminListWords(
  supabase: SupabaseClient,
  status: WordStatus
): Promise<AdminWordRow[]> {
  const { data } = await supabase
    .from("words")
    .select("id, word, status, category_slug, meaning_vi, created_at")
    .eq("status", status)
    .order("word");
  return (data as AdminWordRow[]) ?? [];
}

/** Tạo từ nháp — tương đương endpoint import-draft nhưng từ Admin UI. */
export async function adminCreateWord(
  supabase: SupabaseClient,
  word: string
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("words")
    .insert({ word: word.trim().toLowerCase(), meaning_vi: "", meaning_en: "", status: "draft" })
    .select("id")
    .single();
  if (error) {
    return { error: error.code === "23505" ? `Từ "${word}" đã tồn tại.` : error.message };
  }
  return { id: data.id };
}

export interface AdminWordPatch {
  status?: WordStatus;
  category_slug?: string | null;
  word_type?: string;
  meaning_vi?: string;
  meaning_en?: string;
  basics_vi?: string;
}

export async function adminUpdateWord(
  supabase: SupabaseClient,
  id: string,
  patch: AdminWordPatch
): Promise<string | null> {
  const { error } = await supabase.from("words").update(patch).eq("id", id);
  return error ? error.message : null;
}
