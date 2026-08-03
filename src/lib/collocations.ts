"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, Collocation, CollocationVariant, Exercise } from "./types";
import { VARIANT_CONTEXTS } from "./types";

type CollocationRow = Omit<Collocation, "variants" | "exercises" | "word_ids" | "topic" | "topicOrder"> & {
  category: Pick<Category, "name" | "sort_order"> | null;
  variants: CollocationVariant[] | null;
  exercises: Exercise[] | null;
  links: { word_id: string }[] | null;
};

const SELECT =
  "*, category:categories(name, sort_order), variants:collocation_variants(*), exercises(*), links:word_collocations(word_id)";

const contextOrder = (c: string) => {
  const i = (VARIANT_CONTEXTS as readonly string[]).indexOf(c);
  return i === -1 ? VARIANT_CONTEXTS.length : i;
};

/** Làm phẳng các bảng liên quan thành shape Collocation mà UI dùng. */
function attach(row: CollocationRow): Collocation {
  const { category, variants, exercises, links, ...c } = row;
  return {
    ...c,
    examples: Array.isArray(c.examples) ? c.examples : [],
    variants: [...(variants ?? [])].sort(
      (a, b) => contextOrder(a.context) - contextOrder(b.context) || a.sort_order - b.sort_order
    ),
    exercises: [...(exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    word_ids: (links ?? []).map((l) => l.word_id),
    topic: category?.name ?? "Chưa phân loại",
    topicOrder: category?.sort_order ?? 999,
  };
}

/** Toàn bộ collocation đã phát hành, kèm variants / exercises / từ đơn cấu thành. */
export async function fetchCollocations(supabase: SupabaseClient): Promise<Collocation[]> {
  const { data } = await supabase.from("collocations").select(SELECT).eq("status", "published");
  return ((data as CollocationRow[]) ?? []).map(attach);
}

export async function fetchCollocation(
  supabase: SupabaseClient,
  id: string
): Promise<Collocation | null> {
  const { data } = await supabase
    .from("collocations")
    .select(SELECT)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  return data ? attach(data as CollocationRow) : null;
}

/** Bản admin: đọc ở bất kỳ status nào (RLS chỉ cho admin qua). */
export async function fetchCollocationAdmin(
  supabase: SupabaseClient,
  id: string
): Promise<Collocation | null> {
  const { data } = await supabase.from("collocations").select(SELECT).eq("id", id).maybeSingle();
  return data ? attach(data as CollocationRow) : null;
}

/** Lọc các collocation có chứa một từ đơn — dùng ở trang chi tiết từ. */
export function collocationsForWord(all: Collocation[], wordId: string): Collocation[] {
  return all.filter((c) => c.word_ids.includes(wordId));
}
