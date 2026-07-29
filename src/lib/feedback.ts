import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedbackCategory } from "./types";

export async function submitFeedback(
  supabase: SupabaseClient,
  wordId: string,
  userId: string,
  category: FeedbackCategory,
  content: string,
) {
  const { error } = await supabase.from("feedbacks").insert({
    word_id: wordId,
    user_id: userId,
    category,
    content,
    status: "new",
  });
  if (error) throw error;
}
