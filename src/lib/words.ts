"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Word } from "./types";

/**
 * Tải toàn bộ TỪ ĐƠN cho người học — lọc rõ status published, vì tài khoản admin
 * được RLS cho đọc mọi status nhưng app học vẫn chỉ hiển thị từ đã phát hành.
 */
export async function fetchWords(supabase: SupabaseClient): Promise<Word[]> {
  const { data } = await supabase.from("words").select("*").eq("status", "published");
  return (data as Word[]) ?? [];
}

/** Tải một từ theo id cho người học (chỉ published). */
export async function fetchWord(supabase: SupabaseClient, id: string): Promise<Word | null> {
  const { data } = await supabase
    .from("words")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  return (data as Word) ?? null;
}

/** Bản admin: đọc một từ ở bất kỳ status nào (RLS chỉ cho admin qua). */
export async function fetchWordAdmin(supabase: SupabaseClient, id: string): Promise<Word | null> {
  const { data } = await supabase.from("words").select("*").eq("id", id).maybeSingle();
  return (data as Word) ?? null;
}
