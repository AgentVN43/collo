"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, Word } from "./types";

type WordRow = Omit<Word, "topic" | "topicOrder"> & {
  category: Pick<Category, "name" | "sort_order"> | null;
};

const SELECT = "*, category:categories(name, sort_order)";

function attach(row: WordRow): Word {
  const { category, ...w } = row;
  return {
    ...w,
    topic: category?.name ?? "Chưa phân loại",
    topicOrder: category?.sort_order ?? 999,
  };
}

/**
 * Tải toàn bộ từ cho NGƯỜI HỌC — lọc rõ status published, vì tài khoản admin
 * được RLS cho đọc mọi status nhưng app học vẫn chỉ hiển thị từ đã phát hành.
 */
export async function fetchWords(supabase: SupabaseClient): Promise<Word[]> {
  const { data } = await supabase.from("words").select(SELECT).eq("status", "published");
  return ((data as WordRow[]) ?? []).map(attach);
}

/** Tải một từ theo id cho người học (chỉ published). */
export async function fetchWord(supabase: SupabaseClient, id: string): Promise<Word | null> {
  const { data } = await supabase
    .from("words")
    .select(SELECT)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  return data ? attach(data as WordRow) : null;
}

/** Bản admin: đọc một từ ở bất kỳ status nào (RLS chỉ cho admin qua). */
export async function fetchWordAdmin(supabase: SupabaseClient, id: string): Promise<Word | null> {
  const { data } = await supabase.from("words").select(SELECT).eq("id", id).maybeSingle();
  return data ? attach(data as WordRow) : null;
}
