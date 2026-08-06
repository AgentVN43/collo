export const WORD_STATUSES = ["draft", "processing", "published", "archived"] as const;
export type WordStatus = (typeof WORD_STATUSES)[number];

export const STATUS_LABELS: Record<WordStatus, string> = {
  draft: "Nháp",
  processing: "Đang duyệt",
  published: "Đã phát hành",
  archived: "Lưu trữ",
};

/** 7 loại collocation chuẩn — thuộc về COLLOCATION, không phải từ đơn. */
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

// ---- Từ đơn: đơn vị học Level 1 ----

export interface Word {
  id: string;
  word: string;
  word_type: string;
  status: WordStatus;
  meaning_vi: string;
  meaning_en: string;
  basics_vi: string;
  created_at?: string;
}

// ---- Collocation: đơn vị học Level 2 ----

/** Mức trang trọng của một cách nói. Chỉ 2 mức vì đó là 2 tình huống dùng thật. */
export const REGISTERS = ["formal", "casual"] as const;
export type Register = (typeof REGISTERS)[number];

export const REGISTER_LABELS: Record<Register, string> = {
  formal: "Trang trọng",
  casual: "Thân mật",
};

export const REGISTER_HINTS: Record<Register, string> = {
  formal: "Email, báo cáo, nói với khách hàng hoặc cấp trên",
  casual: "Trò chuyện, nhắn tin Slack / Zalo / Viber hằng ngày",
};

/**
 * Một lượt thoại trong hội thoại mẫu.
 * `text` là tiếng Anh (thứ người học đọc/nghe), `translate` là bản dịch tiếng Việt —
 * chỉ hiện khi người học chủ động mở, để không phá việc luyện đọc hiểu.
 */
export interface ConversationTurn {
  speaker: string;
  text: string;
  translate?: string;
}

/**
 * Ý định giao tiếp — điều người học muốn NÓI.
 * Nhiều cách nói (collocation) khác register cùng phục vụ một intent.
 */
export interface Intent {
  id: string;
  name_vi: string;
  description_vi: string;
  situation: string;
  status: WordStatus;
  created_at?: string;
}

export interface Collocation {
  id: string;
  chunk: string;
  literal_meaning: string;
  category_slug: string | null;
  intent_id: string | null;
  register: Register;
  note_vi: string;
  examples: Example[];
  conversation: ConversationTurn[];
  status: WordStatus;
  created_at?: string;
  // Tính phía client từ các bảng liên quan (xem lib/collocations.ts):
  intent: Intent | null;
  exercises: Exercise[];
  word_ids: string[]; // từ đơn cấu thành — dùng cho bước quét nhanh và lọc theo phạm vi
  topic: string; // tên category — dùng cho section ở Home và badge
  topicOrder: number;
}

// ---- Bài tập: một bảng cho mọi dạng, phần riêng nằm trong payload ----

export const EXERCISE_TYPES = ["fill_in", "multiple_choice", "conversation_gap"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/** Các dạng đã có UI chấm điểm. Dạng ngoài danh sách này bị bỏ qua khi dựng phiên luyện. */
export const SUPPORTED_EXERCISE_TYPES: ExerciseType[] = ["fill_in", "multiple_choice"];

export interface FillInPayload {
  before?: string;
  after?: string;
}

export interface MultipleChoicePayload {
  options?: string[];
}

export interface Exercise {
  id: string;
  word_id: string | null;
  collocation_id: string | null;
  type: ExerciseType;
  prompt: string;
  answer: string;
  alt: string[];
  explain_vi: string;
  pattern: string;
  payload: FillInPayload & MultipleChoicePayload & Record<string, unknown>;
  sort_order: number;
}

// ---- Bộ sưu tập (gom từ đơn) ----

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  is_public: boolean;
  allow_contributors: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Feedback (vẫn gắn theo từ đơn) ----

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

// ---- Tiến độ: một bảng, hai tầng phân biệt bằng item_type ----

export type ProgressItemType = "word" | "collocation";

export interface ProgressRow {
  user_id: string;
  item_type: ProgressItemType;
  item_id: string;
  attempts: number;
  fails: number;
  near_misses: number;
  mastery: number;
  last_practiced: string | null;
  next_due: string | null;
}
