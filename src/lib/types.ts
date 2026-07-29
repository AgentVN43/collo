export const PRONOUN_KEYS = ["j", "tu", "il_elle", "nous", "vous", "elles"] as const;
export type PronounKey = (typeof PRONOUN_KEYS)[number];

// Thứ tự trong TENSE_KEYS = thứ tự ưu tiên khi tự chọn thì (curriculum order)
export const TENSE_KEYS = [
  "present",
  "passe_compose",
  "futur_proche",
  "imparfait",
  "futur_simple",
  "plus_que_parfait",
  "futur_anterieur",
  "passe_simple",
  "passe_anterieur",
  "subj_present",
  "subj_passe",
  "subj_imparfait",
  "subj_plus_que_parfait",
  "cond_present",
  "cond_passe",
] as const;
export type TenseKey = (typeof TENSE_KEYS)[number];

export const TENSE_LABELS: Record<TenseKey, string> = {
  present: "Présent",
  passe_compose: "Passé composé",
  futur_proche: "Futur proche",
  imparfait: "Imparfait",
  futur_simple: "Futur simple",
  plus_que_parfait: "Plus-que-parfait",
  futur_anterieur: "Futur antérieur",
  passe_simple: "Passé simple",
  passe_anterieur: "Passé antérieur",
  subj_present: "Subjonctif présent",
  subj_passe: "Subjonctif passé",
  subj_imparfait: "Subjonctif imparfait",
  subj_plus_que_parfait: "Subjonctif plus-que-parfait",
  cond_present: "Conditionnel présent",
  cond_passe: "Conditionnel passé",
};

/** Nhóm theo thức (mood) — dùng cho màn Settings > Tense to Practice. */
export const TENSE_GROUPS: { mood: string; tenses: TenseKey[] }[] = [
  {
    mood: "Indicatif",
    tenses: [
      "present",
      "passe_compose",
      "imparfait",
      "futur_proche",
      "futur_simple",
      "plus_que_parfait",
      "futur_anterieur",
      "passe_simple",
      "passe_anterieur",
    ],
  },
  { mood: "Subjonctif", tenses: ["subj_present", "subj_passe", "subj_imparfait", "subj_plus_que_parfait"] },
  { mood: "Conditionnel", tenses: ["cond_present", "cond_passe"] },
];

export const DEFAULT_ENABLED_TENSES: TenseKey[] = ["present", "passe_compose", "futur_proche"];

export interface Example {
  fr: string;
  vi: string;
}

export interface ClozeItem {
  before: string;
  after: string;
  answer: string;
  alt?: string[];
  hint: string; // infinitive shown in parentheses
  explain_vi: string;
}

export interface TenseData {
  rule_vi: string;
  forms: Record<PronounKey, string>;
  alt?: Partial<Record<PronounKey, string[]>>;
  examples: Example[];
  cloze: ClozeItem[];
}

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

export interface Word {
  id: string;
  word: string;
  word_type: string;
  category_slug: string | null;
  status: WordStatus;
  meaning_vi: string;
  meaning_en: string;
  basics_vi: string;
  conjugations: Partial<Record<TenseKey, TenseData>>;
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
  { value: "conjugation", label: 'Sai "chia động từ"' },
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
  tense: TenseKey;
  level: number;
  attempts: number;
  fails: number;
  near_misses: number;
  mastery: number;
  last_practiced: string | null;
  next_due: string | null;
}
