export const WORD_STATUSES = ["draft", "processing", "published", "archived"] as const;
export type WordStatus = (typeof WORD_STATUSES)[number];

export const STATUS_LABELS: Record<WordStatus, string> = {
  draft: "Nháp",
  processing: "Đang duyệt",
  published: "Đã phát hành",
  archived: "Lưu trữ",
};

export interface Category {
  slug: string;
  name: string;
  description: string;
  sort_order: number;
}

export interface Example {
  en: string;
  vi: string;
  pattern?: string; // công thức ngữ pháp, vd "S+V+O" — chỉ để hiển thị
}

export interface ClozeItem {
  before: string;
  after: string;
  answer: string;
  alt?: string[];
  hint: string; // headword hiển thị trong ngoặc
  explain_vi: string;
  pattern?: string; // công thức ngữ pháp, vd "S+V+O" — chỉ để hiển thị
}

/**
 * Một "cụm cố định" (word partnership) của 1 headword — tương đương "thì" trong bản Pháp
 * cũ, nhưng KHÔNG phải enum toàn cục: mỗi từ có danh sách partnership riêng, số lượng khác nhau.
 */
export interface PartnershipItem {
  key: string; // slug ổn định trong phạm vi 1 từ, vd "in_sync_with" — dùng làm progress key
  phrase: string; // cụm đầy đủ = đáp án Level 1, vd "in sync (with)"
  meaning_vi: string; // nghĩa tiếng Việt riêng của cụm này
  rule_vi: string; // ghi chú cách dùng
  alt?: string[]; // biến thể được chấp nhận khi chấm
  examples: Example[];
  cloze: ClozeItem[];
}

export interface Word {
  id: string;
  word: string;
  word_type: string;
  category_slug: string | null;
  status: WordStatus;
  meaning_vi: string;
  meaning_en: string;
  basics_vi: string;
  partnerships: PartnershipItem[];
  // Tính phía client từ bảng categories (xem lib/words.ts):
  topic: string; // tên category — dùng cho section ở Home, hàng đợi Practice và badge
  topicOrder: number;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  is_public: boolean;
  allow_contributors: boolean;
  created_at: string;
  updated_at: string;
}

export const FEEDBACK_STATUSES = ["new", "wip", "done"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_CATEGORIES = [
  { value: "basics", label: 'Sai "kiến thức cơ bản"' },
  { value: "conjugation", label: 'Sai "cụm từ"' },
  { value: "multiple", label: "Sai nhiều điểm" },
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]["value"];

export interface Feedback {
  id: string;
  word_id: string;
  user_id: string;
  category: FeedbackCategory;
  content: string;
  status: FeedbackStatus;
  created_at: string;
}

export interface ProgressRow {
  user_id: string;
  word_id: string;
  partnership_key: string;
  level: number;
  attempts: number;
  fails: number;
  near_misses: number;
  mastery: number;
  last_practiced: string | null;
  next_due: string | null;
}
