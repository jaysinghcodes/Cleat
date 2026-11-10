/**
 * The text shape of a note learned from a coach edit. Kept in its own file so both
 * the note builder and the keyword scorer can read it.
 */
export const LEARNED_QUESTION_LABEL = "A client asked:";

export const LEARNED_ANSWER_LABEL = "Coach answer:";

export function learnedNoteBody(question: string, answer: string): string {
  return `${LEARNED_QUESTION_LABEL} ${question}\n\n${LEARNED_ANSWER_LABEL} ${answer}`;
}

/** The client question a learned note was written for, or null for an ordinary note. */
export function learnedQuestion(snippet: string): string | null {
  const start = snippet.indexOf(LEARNED_QUESTION_LABEL);
  if (start === -1) return null;
  const rest = snippet.slice(start + LEARNED_QUESTION_LABEL.length);
  const end = rest.indexOf("\n");
  const question = (end === -1 ? rest : rest.slice(0, end)).trim();
  return question.length > 0 ? question : null;
}
