/** Splits an article into embeddable snippets. The title is repeated so retrieval can match it. */
export function chunkArticle(title: string, body: string): string[] {
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  const parts = cleanBody
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const blocks = parts.length > 0 ? parts : [cleanBody];
  const chunks: string[] = [];
  let current = "";
  for (const part of blocks) {
    const next = current ? `${current}\n\n${part}` : part;
    if (next.length > 700 && current) {
      chunks.push(`${cleanTitle}\n${current}`);
      current = part;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(`${cleanTitle}\n${current}`);
  if (chunks.length === 0) chunks.push(cleanTitle);
  return chunks;
}

/** A chunk longer than this is split again at sentence ends. */
const MAX_CHUNK_CHARS = 700;

/** A paragraph shorter than this joins the paragraph before it. */
const MIN_PARAGRAPH_CHARS = 40;

function splitLong(part: string): string[] {
  if (part.length <= MAX_CHUNK_CHARS) return [part];
  const sentences = part.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [part];
  const pieces: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const next = `${current}${sentence}`;
    if (next.length > MAX_CHUNK_CHARS && current.trim()) {
      pieces.push(current.trim());
      current = sentence;
    } else {
      current = next;
    }
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces;
}

/**
 * Splits an article into one snippet per paragraph.
 * A focused snippet matches a narrow question better than a whole note, and the
 * quoted answer is the paragraph that holds the fact.
 * The title is repeated on every snippet so retrieval can match it.
 */
export function chunkArticleByParagraph(title: string, body: string): string[] {
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  const parts = cleanBody
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const merged: string[] = [];
  for (const part of parts.length > 0 ? parts : [cleanBody]) {
    const last = merged.length - 1;
    if (last >= 0 && part.length < MIN_PARAGRAPH_CHARS) merged[last] = `${merged[last]}\n\n${part}`;
    else merged.push(part);
  }
  const chunks = merged
    .flatMap((part) => splitLong(part))
    .filter((part) => part.length > 0)
    .map((part) => `${cleanTitle}\n${part}`);
  if (chunks.length === 0) chunks.push(cleanTitle);
  return chunks;
}

const EXERCISE_LINE = /\. \d+ sets? of /;

/**
 * Splits program text (the programSourceText format) into one snippet per day.
 * The first line names the program and is repeated on every snippet.
 * A line with sets and reps is an exercise. Any other line starts a new day.
 * Text in another shape comes back as one snippet.
 */
export function chunkProgramByDay(text: string): string[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const head = lines[0] ?? "";
  if (!head.startsWith("Program:")) return text.trim() ? [text.trim()] : [];
  const days: string[][] = [];
  for (const line of lines.slice(1)) {
    const current = days[days.length - 1];
    if (EXERCISE_LINE.test(line) && current) current.push(line);
    else days.push([line]);
  }
  if (days.length === 0) return [head];
  return days.map((day) => [head, ...day].join("\n"));
}
