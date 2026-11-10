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
