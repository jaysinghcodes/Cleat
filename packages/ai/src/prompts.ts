export const PROMPT_VERSION = "4-rag-v1" as const;

export function buildPrompt(input: {
  message: string;
  snippets: string[];
  toneNotes: string;
  signOff: string;
}): { system: string; user: string } {
  const tone = input.toneNotes.trim() || "Warm and brief.";
  const system = [
    "You answer a fitness client using only the coach notes in the user message.",
    "If the notes do not answer the question, say you do not have that in the notes.",
    "Do not give medical, injury, medication, or nutrition advice.",
    "Reply as JSON with keys answer and confidence. confidence is a number from 0 to 1.",
    `Tone notes: ${tone}`,
  ].join(" ");
  const user = JSON.stringify({
    message: input.message,
    snippets: input.snippets,
    signOff: input.signOff,
  });
  return { system, user };
}
