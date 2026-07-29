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
      "AI điền meaning, basics_vi, rule_vi, examples, cloze cho mọi thì có sẵn của từ. Forms/alt do hệ thống bảo toàn — AI trả gì cũng bị ghi đè lại bằng bảng chia gốc.",
    vars: {
      word: "nguyên mẫu của từ (vd: aller)",
      category: "slug nhóm chia (nhom-er / nhom-ir / nhom-3)",
      meaning_vi: "nghĩa tiếng Việt hiện có (có thể rỗng)",
      meaning_en: "nghĩa tiếng Anh hiện có (có thể rỗng)",
      tenses_list: "danh sách key thì hiện có, phân cách bằng dấu phẩy",
      skeleton_json: "JSON đầy đủ của từ (word, category, conjugations với forms chuẩn)",
    },
  },
  word_theory: {
    label: "Soạn lý thuyết (basics + rules) cho 1 từ",
    description:
      "AI chỉ điền basics_vi và rule_vi từng thì. Examples/cloze/forms giữ nguyên không đổi.",
    vars: {
      word: "nguyên mẫu của từ",
      category: "slug nhóm chia",
      meaning_vi: "nghĩa tiếng Việt hiện có",
      tenses_list: "danh sách key thì hiện có",
      skeleton_json: "JSON đầy đủ của từ (forms chuẩn để tham chiếu)",
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
