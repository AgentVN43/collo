"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, Collocation, Exercise, Intent, Register } from "./types";
import { REGISTERS } from "./types";

type CollocationRow = Omit<
  Collocation,
  "intent" | "exercises" | "word_ids" | "topic" | "topicOrder"
> & {
  category: Pick<Category, "name" | "sort_order"> | null;
  intent: Intent | null;
  exercises: Exercise[] | null;
  links: { word_id: string }[] | null;
};

const SELECT =
  "*, category:categories(name, sort_order), intent:intents(*), exercises(*), links:word_collocations(word_id)";

/** formal trước casual — người học thường cần bản trang trọng làm chuẩn. */
const registerOrder = (r: string) => {
  const i = (REGISTERS as readonly string[]).indexOf(r);
  return i === -1 ? REGISTERS.length : i;
};

/** Làm phẳng các bảng liên quan thành shape Collocation mà UI dùng. */
function attach(row: CollocationRow): Collocation {
  const { category, exercises, links, ...c } = row;
  return {
    ...c,
    examples: Array.isArray(c.examples) ? c.examples : [],
    conversation: Array.isArray(c.conversation) ? c.conversation : [],
    register: (REGISTERS as readonly string[]).includes(c.register)
      ? (c.register as Register)
      : "formal",
    exercises: [...(exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    word_ids: (links ?? []).map((l) => l.word_id),
    topic: category?.name ?? "Chưa phân loại",
    topicOrder: category?.sort_order ?? 999,
  };
}

/** Toàn bộ collocation đã phát hành, kèm intent / exercises / từ đơn cấu thành. */
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

/**
 * Các cách nói KHÁC cùng một ý định — phần cốt lõi của mô hình Intent:
 * học "nói ý này thế nào cho đúng hoàn cảnh" thay vì học từng cụm rời rạc.
 */
export function siblingsOf(all: Collocation[], collocation: Collocation): Collocation[] {
  if (!collocation.intent_id) return [];
  return all
    .filter((c) => c.intent_id === collocation.intent_id && c.id !== collocation.id)
    .sort((a, b) => registerOrder(a.register) - registerOrder(b.register));
}

/** Gom collocation theo intent, dùng cho màn duyệt theo ý định. */
export function groupByIntent(
  all: Collocation[]
): { intent: Intent; list: Collocation[] }[] {
  const byIntent = new Map<string, { intent: Intent; list: Collocation[] }>();
  for (const c of all) {
    if (!c.intent) continue;
    const entry = byIntent.get(c.intent.id) ?? { intent: c.intent, list: [] };
    entry.list.push(c);
    byIntent.set(c.intent.id, entry);
  }
  return [...byIntent.values()]
    .map(({ intent, list }) => ({
      intent,
      list: list.sort((a, b) => registerOrder(a.register) - registerOrder(b.register)),
    }))
    .sort((a, b) => a.intent.name_vi.localeCompare(b.intent.name_vi, "vi"));
}
