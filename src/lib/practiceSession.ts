import { gradeChunk, gradeContains, type GradeResult } from "./grading";
import type { SessionItem, Stage } from "./practiceItem";
import type { SessionResult } from "./progress";
import { REGISTER_LABELS } from "./types";

/**
 * Toàn bộ luật của một phiên luyện, gói trong một đối tượng và các phép biến đổi THUẦN.
 *
 * Không import React ở đây, có chủ đích: mọi luật trong file này chạy được bằng node nên
 * mô phỏng và kiểm chứng được trước khi mở app. Ba lỗi trước đây (chuyển chặng sai, rò
 * phạm vi, giàn giáo chết) đều đến từ chỗ luật bị suy ra từ nhiều biến state rời rạc.
 */

/** Bậc khó của từng chặng. Bất biến: sau khi SAI, chặng kế không bao giờ được khó hơn. */
export const DIFFICULTY: Record<Stage, number> = {
  scan: 0,
  unscramble: 1,
  recall: 2,
  scenario: 3,
};

export interface ItemLog {
  title: string;
  /** Điểm của riêng lượt vừa rồi, 0…1. */
  score: number;
  /** Bậc mastery trước và sau — thứ duy nhất nói lên có thuộc thêm được gì không. */
  before: number;
  after: number;
}

export interface Session {
  items: SessionItem[];
  idx: number;
  /** Kế hoạch chặng của CỤM hiện tại. Đổi được lúc chạy khi người học sai. */
  plan: Stage[];
  stageIdx: number;
  /** Đã lùi về bài dễ hơn một lần cho cụm này chưa — mỗi cụm chỉ lùi một lần. */
  scaffolded: boolean;
  input: string;
  placed: number[];
  result: GradeResult | null;
  note: string | null;
  /** Điểm tích luỹ của cụm hiện tại; mỗi chặng được chấm là một lượt. */
  tally: SessionResult;
  log: ItemLog[];
  /** Luyện kỹ một cụm chọn đích danh — không có "cụm tiếp theo" để đi. */
  drill: boolean;
  done: boolean;
}

export type Action =
  | { type: "begin"; items: SessionItem[]; drill: boolean }
  | { type: "setInput"; value: string }
  | { type: "setPlaced"; value: number[] }
  | { type: "submit" }
  | { type: "giveUp" }
  | { type: "advance" }
  | { type: "nextItem"; before: number; after: number };

/** Hàm chứ không phải hằng — tránh mọi state dùng chung một mảng `placed`. */
const clean = (): Pick<Session, "input" | "placed" | "result" | "note"> => ({
  input: "",
  placed: [],
  result: null,
  note: null,
});

export function emptySession(): Session {
  return {
    items: [],
    idx: 0,
    plan: [],
    stageIdx: 0,
    scaffolded: false,
    ...clean(),
    tally: { correct: 0, near: 0, wrong: 0 },
    log: [],
    drill: false,
    done: false,
  };
}

export const currentItem = (s: Session): SessionItem | undefined => s.items[s.idx];
export const currentStage = (s: Session): Stage | undefined => s.plan[s.stageIdx];

export function sessionScore(r: SessionResult): number {
  const total = r.correct + r.near + r.wrong;
  return total === 0 ? 0 : (r.correct + r.near * 0.5) / total;
}

/**
 * Kế hoạch sau khi trả lời xong chặng hiện tại.
 *
 * Sai mà chưa được lùi lần nào → chèn "xếp hình" ngay sau chặng đang dở, đồng thời
 * CẮT các chặng còn lại. Nhớ không ra mà chặng kế là "thực chiến" thì là bắt làm bài
 * khó hơn ngay sau khi thất bại — ngược hẳn ý đồ giàn giáo.
 */
export function willScaffold(s: Session): boolean {
  const stage = currentStage(s);
  return !!stage && s.result === "wrong" && !s.scaffolded && stage !== "unscramble";
}

export function planAfter(s: Session): Stage[] {
  const stage = currentStage(s);
  if (!stage || s.result !== "wrong") return s.plan;
  const head = s.plan.slice(0, s.stageIdx + 1);
  if (willScaffold(s)) return [...head, "unscramble"];
  // Không còn bài nào dễ hơn để lùi (đã lùi rồi, hoặc đang ở chính chặng dễ nhất)
  // → dừng cụm này lại. Leo sang chặng khó hơn ngay sau khi thất bại là vô ích.
  return head;
}

/** Còn chặng nào nữa cho cụm này không (đã tính cả giàn giáo sắp chèn)? */
export function hasNextStage(s: Session): boolean {
  return s.stageIdx + 1 < planAfter(s).length;
}

/** Cụm hiện tại là cụm cuối, và cũng đã hết chặng → phiên kết thúc sau bước này. */
export function isSessionEnd(s: Session): boolean {
  return !hasNextStage(s) && s.idx + 1 >= s.items.length;
}

/** Chặng "quét nhanh" chỉ để nhìn, không chấm điểm. */
export const isGraded = (stage: Stage | undefined) => stage !== undefined && stage !== "scan";

function evaluate(item: SessionItem, stage: Stage, s: Session): { r: GradeResult; note: string | null } {
  if (stage === "unscramble") {
    const given = s.placed.map((i) => item.tiles[i]).join(" ");
    return { r: gradeChunk(given, item.collocation.chunk), note: null };
  }
  // Gõ tay: cho phép nói thành câu, các từ quanh cụm không tính là lỗi
  const r = gradeContains(s.input, item.collocation.chunk);
  if (r !== "wrong") return { r, note: null };
  const sib = item.siblings.find((x) => gradeContains(s.input, x.chunk) === "correct");
  if (!sib) return { r, note: null };
  return {
    r: "near",
    note: `Đúng ý rồi — nhưng đó là cách nói ${REGISTER_LABELS[
      sib.register
    ].toLowerCase()}, bài đang hỏi bản ${REGISTER_LABELS[item.collocation.register].toLowerCase()}.`,
  };
}

function record(s: Session, r: GradeResult, note: string | null): Session {
  const key = r === "correct" ? "correct" : r === "near" ? "near" : "wrong";
  return {
    ...s,
    result: r,
    note,
    tally: { ...s.tally, [key]: s.tally[key] + 1 },
  };
}

function openItem(s: Session, idx: number): Session {
  return {
    ...s,
    idx,
    plan: s.items[idx].stages,
    stageIdx: 0,
    scaffolded: false,
    ...clean(),
    tally: { correct: 0, near: 0, wrong: 0 },
  };
}

export function reduce(s: Session, a: Action): Session {
  switch (a.type) {
    case "begin":
      if (a.items.length === 0) return s;
      return openItem(
        { ...emptySession(), items: a.items, drill: a.drill },
        0
      );

    case "setInput":
      return s.result ? s : { ...s, input: a.value };

    case "setPlaced":
      return s.result ? s : { ...s, placed: a.value };

    case "submit": {
      const item = currentItem(s);
      const stage = currentStage(s);
      if (!item || !stage || s.result || !isGraded(stage)) return s;
      const { r, note } = evaluate(item, stage, s);
      return record(s, r, note);
    }

    case "giveUp": {
      const stage = currentStage(s);
      if (!stage || s.result || !isGraded(stage)) return s;
      return record(s, "wrong", null);
    }

    case "advance": {
      const stage = currentStage(s);
      if (!stage) return s;
      // Quét nhanh không chấm nên qua thẳng; các chặng khác phải trả lời xong mới đi tiếp
      if (isGraded(stage) && !s.result) return s;
      const plan = planAfter(s);
      const scaffolded = s.scaffolded || willScaffold(s);
      if (s.stageIdx + 1 >= plan.length) return s; // hết chặng → phải dùng "nextItem"
      return { ...s, plan, scaffolded, stageIdx: s.stageIdx + 1, ...clean() };
    }

    case "nextItem": {
      const item = currentItem(s);
      if (!item) return s;
      const log: ItemLog[] = [
        ...s.log,
        {
          title: item.collocation.chunk,
          score: sessionScore(s.tally),
          before: a.before,
          after: a.after,
        },
      ];
      if (s.idx + 1 >= s.items.length) return { ...s, log, done: true };
      return openItem({ ...s, log }, s.idx + 1);
    }
  }
}
