import type { PronounKey } from "./types";

const VOWELS = "aeiouhéèêàâîïôûy";

/** Display label for a pronoun given the verb form that follows it (je → j' before vowel). */
export function pronounLabel(key: PronounKey, form: string): string {
  switch (key) {
    case "j":
      return VOWELS.includes((form[0] || "").toLowerCase()) ? "j'" : "je";
    case "tu":
      return "tu";
    case "il_elle":
      return "il/elle";
    case "nous":
      return "nous";
    case "vous":
      return "vous";
    case "elles":
      return "elles";
  }
}

export function joinPronoun(key: PronounKey, form: string): string {
  const label = pronounLabel(key, form);
  return label.endsWith("'") ? `${label}${form}` : `${label} ${form}`;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/’/g, "'");
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/ç/g, "c");
}

export type GradeResult = "correct" | "near" | "wrong";

/**
 * Grade an answer. "near" = only accents/diacritics differ (counts as near-miss,
 * not a hard fail). Alternatives (e.g. feminine agreement) count as correct.
 */
export function grade(input: string, answer: string, alts: string[] = []): GradeResult {
  const given = normalize(input);
  if (!given) return "wrong";
  const accepted = [answer, ...alts].map(normalize);
  if (accepted.includes(given)) return "correct";
  if (accepted.some((a) => stripAccents(a) === stripAccents(given))) return "near";
  return "wrong";
}

export const ACCENT_CHARS = ["é", "è", "ê", "ë", "à", "â", "ç", "î", "ï", "ô", "û", "ù"];
