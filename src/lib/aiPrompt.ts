import type { Collocation } from "./types";

/**
 * Dựng prompt để người học mang sang một trợ lý AI bất kỳ mà luyện hội thoại mở.
 *
 * Đây là LỐI RA, không phải một bậc trong thang tiến độ: không có gì quay ngược về app,
 * không transcript, không điểm, không đụng tới `mastery`. Giá trị nằm ở chất lượng prompt
 * chứ không ở đường link — prompt chung chung chỉ nhận về một bài giảng dài dòng.
 *
 * Viết bằng tiếng Anh để mô hình bám luật tốt hơn, nhưng bắt sửa lỗi bằng tiếng Việt
 * vì đó là thứ người học đọc nhanh nhất.
 */
export function buildPracticePrompt(c: Collocation): string {
  const register =
    c.register === "formal"
      ? "formal (email, reports, clients, managers)"
      : "casual (chat with colleagues, Slack, everyday talk)";

  const lines = [
    `You are my English conversation partner. I am a Vietnamese learner practising one specific collocation.`,
    ``,
    `Target collocation: "${c.chunk}"`,
    `Meaning: ${c.literal_meaning}`,
    `Register: ${register}`,
  ];

  if (c.intent?.name_vi) lines.push(`What I want to be able to express: ${c.intent.name_vi}`);
  if (c.note_vi) lines.push(`Usage note (Vietnamese): ${c.note_vi}`);

  lines.push(
    ``,
    `Rules:`,
    `1. Role-play a realistic ${c.topic || "workplace"} situation where this collocation fits naturally. You speak first.`,
    `2. Keep every reply to 1-2 short sentences and always end with a question, so I have to answer.`,
    `3. Steer the conversation so that I need to use "${c.chunk}" myself.`,
    `4. Do NOT use "${c.chunk}" in your own lines until I have used it correctly at least twice.`,
    `5. After each of my replies, add one short correction line in Vietnamese if I made a mistake, then carry on with the role-play.`,
    `6. Stay in the ${c.register} register throughout.`,
    ``,
    `Start now with your first line.`
  );

  return lines.join("\n");
}

/**
 * Link mở thẳng ChatGPT kèm prompt.
 *
 * Tham số `?q=` không có tài liệu chính thức nên có thể đổi bất cứ lúc nào — vì vậy
 * nút "Copy prompt" mới là đường chính, còn link này là tiện ích thêm.
 */
export function chatGptUrl(prompt: string): string {
  return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
}
