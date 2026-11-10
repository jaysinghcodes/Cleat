import { keywordTokens } from "./keywords";
import { learnedNoteBody } from "./learned-format";
import { checkRefusals } from "./refusals";

export const LEARNED_NOTE_CATEGORY = "faq" as const;

export const LEARNED_TITLE_PREFIX = "Coach answer";

const MAX_TITLE = 120;
const MAX_QUESTION = 500;
const MAX_ANSWER = 4000;

export type LearnedNote = {
  title: string;
  category: typeof LEARNED_NOTE_CATEGORY;
  body: string;
};

export type LearnedSkip = "empty" | "unchanged" | "safety" | "needs_context";

export type LearnedResult = { ok: true; note: LearnedNote } | { ok: false; reason: LearnedSkip };

function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trim();
}

const POINTS_AT_CONTEXT = /\b(?:it|that|this|these|those|they|them|we talked|you said|like before|same as)\b/i;

/**
 * "is that ok?", "thanks!", and "help" only mean something inside their conversation.
 * A note built from one would answer every later client who typed the same words.
 */
export function needsContext(question: string): boolean {
  const terms = new Set(keywordTokens(question));
  if (terms.size === 0) return true;
  if (POINTS_AT_CONTEXT.test(question)) return true;
  return question.split(/\s+/).length < 3;
}

/**
 * Turns a coach edit into a note. The note keeps the client's question next to the
 * coach's answer in one snippet, so a similar question matches the question words
 * and the reply is drawn from the coach's own answer.
 *
 * Nothing is saved when the coach sent the draft unchanged, when the question only
 * makes sense inside its conversation, or when the question is one the safety checks
 * refuse. Refused messages get a fixed template before retrieval, so a note for them
 * could never be used and should not exist.
 */
export function learnedNoteFromEdit(input: { question: string; draftText: string; editedText: string }): LearnedResult {
  const question = clip(squash(input.question), MAX_QUESTION);
  const answer = clip(input.editedText.trim(), MAX_ANSWER);
  if (!question || !answer) return { ok: false, reason: "empty" };
  if (squash(input.draftText) === squash(answer)) return { ok: false, reason: "unchanged" };
  if (checkRefusals(question).kind === "hard_refuse") return { ok: false, reason: "safety" };
  if (needsContext(question)) return { ok: false, reason: "needs_context" };
  const title = clip(`${LEARNED_TITLE_PREFIX}: ${question}`, MAX_TITLE);
  return {
    ok: true,
    note: {
      title,
      category: LEARNED_NOTE_CATEGORY,
      body: learnedNoteBody(question, answer),
    },
  };
}
