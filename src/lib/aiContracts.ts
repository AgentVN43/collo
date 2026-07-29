// Context contract cho AI Center: mỗi task_type quy định nguồn dữ liệu và biến khả dụng.
// Prompt template dùng placeholder {{ten_bien}} — validate lúc lưu, render lúc chạy.

export const AI_TASK_TYPES = ["word_full", "word_theory"] as const;
export type AiTaskType = (typeof AI_TASK_TYPES)[number];

export interface TaskContract {
  label: string;
  description: string;
  /** biến → mô tả (hiện chip gợi ý trong UI soạn prompt) */
  vars: Record<string, string>;
}

export const TASK_CONTRACTS: Record<AiTaskType, TaskContract> = {
  word_full: {
    label: "Soạn toàn bộ nội dung cho 1 từ",
    description:
      "AI điền meaning, basics_vi, rule_vi, examples, cloze cho mọi partnership có sẵn của từ. Phrase/alt do hệ thống bảo toàn — AI trả gì cũng bị ghi đè lại bằng cụm gốc.",
    vars: {
      word: "headword (vd: sync)",
      category: "slug loại collocation (word-partnership / verb-noun / adjective-noun)",
      meaning_vi: "nghĩa tiếng Việt hiện có (có thể rỗng)",
      meaning_en: "định nghĩa tiếng Anh hiện có (có thể rỗng)",
      partnerships_list: "danh sách key + phrase hiện có, phân cách bằng dấu phẩy",
      skeleton_json: "JSON đầy đủ của từ (word, category, partnerships với phrase chuẩn)",
    },
  },
  word_theory: {
    label: "Soạn lý thuyết (basics + rules) cho 1 từ",
    description:
      "AI chỉ điền basics_vi, meaning_vi và rule_vi từng partnership. Examples/cloze/phrase giữ nguyên không đổi.",
    vars: {
      word: "headword",
      category: "slug loại collocation",
      meaning_vi: "nghĩa tiếng Việt hiện có",
      partnerships_list: "danh sách key + phrase hiện có",
      skeleton_json: "JSON đầy đủ của từ (partnerships với phrase chuẩn để tham chiếu)",
    },
  },
};

/** Bóc danh sách {{bien}} trong template. */
export function extractVars(template: string): string[] {
  return [...new Set([...template.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))];
}

/** Trả về danh sách biến không có trong contract (lỗi soạn prompt). */
export function validateTemplate(template: string, taskType: AiTaskType): string[] {
  const allowed = new Set(Object.keys(TASK_CONTRACTS[taskType].vars));
  return extractVars(template).filter((v) => !allowed.has(v));
}

/** Thay {{bien}} bằng giá trị context. Biến thiếu giá trị → giữ nguyên placeholder. */
export function renderPrompt(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (raw, key) => ctx[key] ?? raw);
}
