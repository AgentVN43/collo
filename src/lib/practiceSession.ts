import { diffChunk, gradeChunk, gradeContains, type GradeResult } from "./grading";
import type { SessionItem, Stage } from "./practiceItem";
import type { SessionResult } from "./progress";
import { REGISTER_LABELS } from "./types";

/**
 * Toàn bộ luật của một phiên luyện, gói trong một đối tượng và các phép biến đổi THUẦN.
 *
 * Không import React ở đây, có chủ đích: mọi luật trong file này chạy được bằng node nên
 * mô phỏng và kiểm chứng được trước khi mở app.
 */

/** Bậc khó của từng chặng. Bất biến: sau khi SAI, chặng kế không bao giờ được khó hơn. */
export const DIFFICULTY: Record<Stage, number> = {
  scan: 0,
  unscramble: 1,
  recall: 2,
  scenario: 3,
};

/**
 * Một bước trong kế hoạch của cụm.
 *
 * `graded` là ranh giới then chốt: **chặng nằm trong kế hoạch thì ĐO, chặng sinh ra sau khi
 * sai hoặc do người học tự bấm thêm thì chỉ để LUYỆN**. Vừa nhìn đáp án xong mà gõ lại đúng
 * thì không chứng minh được gì — tính điểm là bơm mastery ảo. Luật này cũng làm cho nút
 * "Học tiếp" chỉ có lợi: thử bài khó hơn không bao giờ làm tụt điểm.
 */
export interface Step {
  stage: Stage;
  graded: boolean;
}

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
  plan: Step[];
  stageIdx: number;
  /** Đã lùi về bài dễ hơn một lần cho cụm này chưa — mỗi cụm chỉ lùi một lần. */
  scaffolded: boolean;
  input: string;
  placed: number[];
  result: GradeResult | null;
  note: string | null;
  /** Điểm tích luỹ của cụm hiện tại; chỉ chặng `graded` mới được cộng vào. */
  tally: SessionResult;
  log: ItemLog[];
  /** Luyện kỹ một cụm chọn đích danh — không có "cụm tiếp theo" để đi. */
  drill: boolean;
  /** Từ chỉ số này trở đi là các cụm được "Học lại" đẩy xuống cuối phiên: luyện, không đo. */
  replayFrom: number | null;
  done: boolean;
}

export type Action =
  | { type: "begin"; items: SessionItem[]; drill: boolean }
  | { type: "setInput"; value: string }
  | { type: "setPlaced"; value: number[] }
  | { type: "submit" }
  | { type: "giveUp" }
  | { type: "advance" }
  | { type: "againNow" }
  | { type: "againLater" }
  | { type: "harder" }
  | { type: "nextItem"; before: number; after: number };

/** Hàm chứ không phải hằng — tránh mọi state dùng chung một mảng `placed`. */
const clean = (): Pick<Session, "input" | "placed" | "result" | "note"> => ({
  input: "",
  placed: [],
  result: null,
  note: null,
});

const planOf = (item: SessionItem): Step[] =>
  item.stages.map((stage) => ({ stage, graded: stage !== "scan" }));

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
    replayFrom: null,
    done: false,
  };
}

export const currentItem = (s: Session): SessionItem | undefined => s.items[s.idx];
export const currentStep = (s: Session): Step | undefined => s.plan[s.stageIdx];
export const currentStage = (s: Session): Stage | undefined => currentStep(s)?.stage;

/** Cụm đang làm là lượt "Học lại" được đẩy xuống cuối phiên → không lưu tiến độ. */
export const isReplay = (s: Session): boolean =>
  s.replayFrom !== null && s.idx >= s.replayFrom;

export function sessionScore(r: SessionResult): number {
  const total = r.correct + r.near + r.wrong;
  return total === 0 ? 0 : (r.correct + r.near * 0.5) / total;
}

export function willScaffold(s: Session): boolean {
  const stage = currentStage(s);
  return !!stage && s.result === "wrong" && !s.scaffolded && stage !== "unscramble";
}

/**
 * Kế hoạch sau khi trả lời xong chặng hiện tại.
 *
 * Sai mà chưa được lùi lần nào → chèn "xếp từ" làm giàn giáo, RỒI cho làm lại chính chặng
 * vừa trượt. Thiếu nhịp làm lại thì vòng học cụt: người học được sửa nhưng không bao giờ
 * chứng minh là giờ đã nhớ ra. Nhịp làm lại đó không tính điểm (xem `Step.graded`).
 *
 * Các chặng còn lại bị cắt: nhớ không ra mà chặng kế là "thực chiến" thì là bắt làm bài
 * khó hơn ngay sau khi thất bại.
 */
export function planAfter(s: Session): Step[] {
  const step = currentStep(s);
  if (!step || s.result !== "wrong") return s.plan;
  const head = s.plan.slice(0, s.stageIdx + 1);
  if (willScaffold(s)) {
    return [...head, { stage: "unscramble", graded: true }, { stage: step.stage, graded: false }];
  }
  // Không còn bài nào dễ hơn để lùi (đã lùi rồi, hoặc đang ở chính chặng dễ nhất) → dừng cụm.
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

/** Cụm này có lỗi nào chưa — dùng để chỉ hiện "Học lại" khi nó thật sự có nghĩa. */
export const hadError = (s: Session): boolean => s.tally.wrong > 0 || s.tally.near > 0;

/** "Học tiếp" chỉ mở khi mọi chặng được đo đều đúng, và cụm có dựng được tình huống. */
export function canGoHarder(s: Session): boolean {
  const item = currentItem(s);
  if (!item?.scenario || hadError(s)) return false;
  return !s.plan.some((p) => p.stage === "scenario");
}

/** Chặng "quét nhanh" chỉ để nhìn, không chấm điểm. */
export const isGraded = (stage: Stage | undefined) => stage !== undefined && stage !== "scan";

function evaluate(
  item: SessionItem,
  stage: Stage,
  s: Session
): { r: GradeResult; note: string | null } {
  if (stage === "unscramble") {
    const given = s.placed.map((i) => item.tiles[i]).join(" ");
    return { r: gradeChunk(given, item.collocation.chunk), note: null };
  }
  // Gõ tay: cho phép nói thành câu, các từ quanh cụm không tính là lỗi
  const r = gradeContains(s.input, item.collocation.chunk);
  // Sai ở đâu thì nói ra — kết quả không có lý do sẽ giống một phán quyết tuỳ tiện
  if (r === "correct") return { r, note: null };
  if (r === "near") return { r, note: diffChunk(s.input, item.collocation.chunk) };
  const sib = item.siblings.find((x) => gradeContains(s.input, x.chunk) === "correct");
  if (!sib) return { r, note: diffChunk(s.input, item.collocation.chunk) };
  return {
    r: "near",
    note: `Đúng ý rồi — nhưng đó là cách nói ${REGISTER_LABELS[
      sib.register
    ].toLowerCase()}, bài đang hỏi bản ${REGISTER_LABELS[item.collocation.register].toLowerCase()}.`,
  };
}

function record(s: Session, r: GradeResult, note: string | null): Session {
  const step = currentStep(s);
  // Chặng không được đo thì vẫn hiện đúng/sai cho người học, chỉ là không vào điểm
  if (!step?.graded) return { ...s, result: r, note };
  const key = r === "correct" ? "correct" : r === "near" ? "near" : "wrong";
  return { ...s, result: r, note, tally: { ...s.tally, [key]: s.tally[key] + 1 } };
}

function openItem(s: Session, idx: number): Session {
  return {
    ...s,
    idx,
    plan: planOf(s.items[idx]),
    stageIdx: 0,
    scaffolded: false,
    ...clean(),
    tally: { correct: 0, near: 0, wrong: 0 },
  };
}

/** Nối thêm các chặng chỉ-để-luyện vào cuối kế hoạch rồi nhảy sang chặng đầu tiên trong đó. */
function appendPractice(s: Session, stages: Stage[]): Session {
  const plan = [...s.plan, ...stages.map((stage) => ({ stage, graded: false }))];
  return { ...s, plan, stageIdx: s.plan.length, ...clean() };
}

export function reduce(s: Session, a: Action): Session {
  switch (a.type) {
    case "begin":
      if (a.items.length === 0) return s;
      return openItem({ ...emptySession(), items: a.items, drill: a.drill }, 0);

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

    // "Học lại" ở chế độ luyện kỹ một cụm: làm lại ngay, không tính điểm
    case "againNow":
      return currentItem(s) ? appendPractice(s, ["unscramble", "recall"]) : s;

    // "Học lại" ở phiên tự do: đẩy cụm xuống CUỐI phiên. Làm lại ngay là hình thức yếu
    // nhất — cụm còn trong trí nhớ ngắn hạn, đọc lại chứ không phải nhớ ra.
    case "againLater": {
      const item = currentItem(s);
      if (!item || isReplay(s)) return s;
      return {
        ...s,
        items: [...s.items, item],
        replayFrom: s.replayFrom ?? s.items.length,
      };
    }

    // "Học tiếp": tự nguyện thử chặng khó hơn, không tính điểm nên chỉ có lợi
    case "harder":
      return canGoHarder(s) ? appendPractice(s, ["scenario"]) : s;

    case "nextItem": {
      const item = currentItem(s);
      if (!item) return s;
      // Lượt học lại không ghi nhật ký: nó không làm mastery nhúc nhích, ghi vào chỉ gây nhiễu
      const log: ItemLog[] = isReplay(s)
        ? s.log
        : [
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
