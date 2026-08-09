import { tokenize } from "./grading";
import { masteryOf } from "./progress";
import type { Collocation, ConversationTurn, ProgressRow, Word } from "./types";

/**
 * Các chặng của một cụm. KHÔNG phải kịch bản một phiên — mỗi phiên chỉ chạy 1–2 chặng,
 * chặng nào là do mastery quyết định. Chạy liền một mạch cả 4 chặng là học dồn:
 * đến chặng nhớ thì cụm vẫn còn trong trí nhớ làm việc, mastery tăng ảo, lịch ôn hỏng theo.
 */
export type Stage = "scan" | "unscramble" | "recall" | "scenario";

export const STAGE_LABEL: Record<Stage, string> = {
  scan: "👀 Quét nhanh",
  unscramble: "🧩 Xếp từ",
  recall: "🧠 Vắt óc nhớ",
  scenario: "🎬 Thực chiến",
};

/** Tình huống lấy từ hội thoại mẫu: các lượt trước lượt chứa chunk. */
export interface Scenario {
  context: ConversationTurn[];
  /** Tên người mà học viên sẽ đóng vai để đáp lại. */
  speaker: string;
  /** Lượt thoại gốc chứa chunk — làm câu mẫu khi trả bài. */
  model: string;
}

export interface SessionItem {
  collocation: Collocation;
  /** Từ đơn cấu thành, cho chặng quét nhanh. */
  scanWords: Word[];
  /** Các từ trong chunk, đã xáo thứ tự. */
  tiles: string[];
  /** Cách nói khác cùng ý định — để nhận ra "đúng ý, sai register". */
  siblings: Collocation[];
  scenario: Scenario | null;
  stages: Stage[];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Xáo các từ của chunk, đảm bảo không trả về đúng thứ tự gốc (bài sẽ vô nghĩa). */
export function tilesFor(chunk: string): string[] {
  const words = chunk.trim().split(/\s+/);
  if (words.length < 2) return words;
  const original = words.join(" ");
  for (let i = 0; i < 10; i++) {
    const out = shuffle(words);
    if (out.join(" ") !== original) return out;
  }
  // Xáo 10 lần vẫn trùng → mọi từ giống nhau, thứ tự nào cũng đúng
  return words;
}

/**
 * Tìm tình huống trong hội thoại mẫu.
 *
 * Dò lượt chứa chunk bằng cách đếm từ trùng chứ không dùng `indexOf`: thoại luôn chia
 * động từ theo ngữ cảnh ("deploy the code" → "we deployed the code"), so chuỗi thẳng
 * sẽ trượt. Khi workflow gắn dấu [chunk] vào text thì thay hàm này bằng dò dấu.
 */
export function scenarioFor(c: Collocation): Scenario | null {
  const turns = c.conversation ?? [];
  const chunkTokens = tokenize(c.chunk);
  if (turns.length < 2 || chunkTokens.length === 0) return null;

  let bestIdx = -1;
  let bestScore = 0;
  turns.forEach((t, i) => {
    const inTurn = new Set(tokenize(t.text));
    const score = chunkTokens.filter((w) => inTurn.has(w)).length / chunkTokens.length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });

  // Cần khớp gần hết chunk, VÀ phải có lượt đứng trước mới thành tình huống
  if (bestIdx < 1 || bestScore < 0.7) return null;
  return {
    context: turns.slice(Math.max(0, bestIdx - 3), bestIdx),
    speaker: turns[bestIdx].speaker,
    model: turns[bestIdx].text,
  };
}

/**
 * Thang tiến theo mastery. Gặp lại lần sau thì cụm leo lên một bậc khó hơn,
 * cách nhau đúng số ngày mà `next_due` quy định.
 */
export function stagesFor(mastery: number, hasScenario: boolean): Stage[] {
  if (mastery <= 0) return ["scan", "unscramble"]; // chưa mã hoá thì không thể lấy ra
  if (mastery === 1) return ["unscramble", "recall"];
  if (mastery <= 3) return ["recall"]; // sai thì tự rơi xuống "unscramble" làm giàn giáo
  return hasScenario ? ["recall", "scenario"] : ["recall"];
}

/**
 * Toàn bộ thang trong MỘT phiên — dùng khi người học chủ động chọn đúng một cụm để
 * luyện kỹ. Ở đây họ đang cố ý bỏ qua lịch ôn, nên đưa hết chặng ra thay vì nhỏ giọt
 * theo mastery như phiên random.
 */
export function fullLadder(hasScenario: boolean): Stage[] {
  const all: Stage[] = ["scan", "unscramble", "recall"];
  return hasScenario ? [...all, "scenario"] : all;
}

export function buildItem(
  c: Collocation,
  words: Word[],
  all: Collocation[],
  rows: ProgressRow[],
  /** true = luyện kỹ một cụm được chọn đích danh: chạy hết thang trong một phiên. */
  drill = false
): SessionItem {
  const scenario = scenarioFor(c);
  const hasScenario = scenario !== null;
  return {
    collocation: c,
    scanWords: words.filter((w) => c.word_ids.includes(w.id)),
    tiles: tilesFor(c.chunk),
    siblings: all.filter((x) => x.intent_id && x.intent_id === c.intent_id && x.id !== c.id),
    scenario,
    stages: drill
      ? fullLadder(hasScenario)
      : stagesFor(masteryOf(rows, "collocation", c.id), hasScenario),
  };
}
