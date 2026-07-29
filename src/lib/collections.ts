"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection } from "./types";

export interface CollectionWithCount extends Collection {
  word_count: number;
}

/** Bộ sưu tập của user hiện tại, mới cập nhật xếp trước, kèm số từ. */
export async function fetchCollections(supabase: SupabaseClient): Promise<CollectionWithCount[]> {
  const { data } = await supabase
    .from("collections")
    .select("*, collection_words(count)")
    .order("updated_at", { ascending: false });
  return ((data as (Collection & { collection_words: { count: number }[] })[]) ?? []).map(
    ({ collection_words, ...c }) => ({ ...c, word_count: collection_words?.[0]?.count ?? 0 })
  );
}

export async function createCollection(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<Collection | null> {
  const { data } = await supabase
    .from("collections")
    .insert({ user_id: userId, name: name.trim() })
    .select()
    .single();
  return (data as Collection) ?? null;
}

/** Các collection_id đang chứa một từ (trong các bộ của user). */
export async function membershipForWord(
  supabase: SupabaseClient,
  wordId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("collection_words")
    .select("collection_id")
    .eq("word_id", wordId);
  return new Set((data ?? []).map((r) => r.collection_id as string));
}

/** Toàn bộ word_id đã lưu trong bất kỳ bộ sưu tập nào của user (để tô icon 🔖 ở Home). */
export async function savedWordIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.from("collection_words").select("word_id");
  return new Set((data ?? []).map((r) => r.word_id as string));
}

/** Word_id thuộc một bộ sưu tập (để build phiên luyện theo bộ). */
export async function collectionWordIds(
  supabase: SupabaseClient,
  collectionId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("collection_words")
    .select("word_id")
    .eq("collection_id", collectionId);
  return new Set((data ?? []).map((r) => r.word_id as string));
}

export async function toggleWordInCollection(
  supabase: SupabaseClient,
  collectionId: string,
  wordId: string,
  add: boolean
): Promise<void> {
  if (add) {
    await supabase.from("collection_words").insert({ collection_id: collectionId, word_id: wordId });
  } else {
    await supabase
      .from("collection_words")
      .delete()
      .eq("collection_id", collectionId)
      .eq("word_id", wordId);
  }
  await supabase
    .from("collections")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", collectionId);
}
