/**
 * Keyword side of retrieval and of the confidence score.
 * Everything here is plain token matching. Nothing in this file is a model.
 */

const STOPWORDS = new Set(
  [
    "a an the this that these those there here",
    "i im ive id ill me my mine we our us you your u ur it its they them their",
    "is are am was were be been being do does did doing have has had",
    "can could should would will shall may might must",
    "what whats when whens where wheres who whos why how hows which",
    "to of on in at for from by with about into as and or but if then so than too also",
    "not no dont doesnt cant wont isnt",
    "much many any some just really very still get got go going",
    "please thanks thank hey hi hello ok okay yes yeah",
    "need want like look know tell use make let see say try",
    "long instead now time thing something anything way sure again only well right yesterday",
  ]
    .join(" ")
    .split(" "),
);

/** Trims a plural or a verb ending. Both sides of a match go through this, so it only has to be consistent. */
export function stem(token: string): string {
  if (/^\d+$/.test(token)) return token;
  let word = token;
  if (word.length > 5 && word.endsWith("ing")) word = word.slice(0, -3);
  else if (word.length > 4 && word.endsWith("ed")) word = word.slice(0, -2);
  else if (word.length > 4 && word.endsWith("es") && !word.endsWith("ses")) word = word.slice(0, -1);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) word = word.slice(0, -1);
  if (word.length > 3 && /([b-df-hj-np-tv-z])\1$/.test(word) && !/(ll|ss|ff)$/.test(word)) word = word.slice(0, -1);
  return word;
}

function rawTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

/** Stemmed content words. Question words, pronouns, and other filler are dropped. */
export function keywordTokens(text: string): string[] {
  return rawTokens(text)
    .filter((token) => !STOPWORDS.has(token) && (token.length >= 2 || /^\d$/.test(token)))
    .map((token) => stem(token));
}

/** One edit apart: a swap of neighbours, a missing letter, an extra letter, or a wrong letter. */
export function oneEditApart(left: string, right: string): boolean {
  if (left === right) return true;
  const gap = left.length - right.length;
  if (gap > 1 || gap < -1) return false;
  const [short, long] = gap <= 0 ? [left, right] : [right, left];
  let index = 0;
  while (index < short.length && short[index] === long[index]) index += 1;
  if (short.length === long.length) {
    if (short.slice(index + 1) === long.slice(index + 1)) return true;
    return (
      short[index] === long[index + 1] &&
      short[index + 1] === long[index] &&
      short.slice(index + 2) === long.slice(index + 2)
    );
  }
  return short.slice(index) === long.slice(index + 1);
}

/** Typos are only forgiven on longer words that start with the same letter. */
const MIN_TYPO_LENGTH = 5;

export type KeywordIndex = {
  tokens: string[];
  set: Set<string>;
  /** Neighbouring words written as one, so "warmup" finds "warm up". */
  joined: Set<string>;
};

export function indexKeywords(text: string): KeywordIndex {
  const tokens = keywordTokens(text);
  const joined = new Set<string>();
  for (let index = 0; index + 1 < tokens.length; index += 1) {
    joined.add(`${tokens[index]}${tokens[index + 1]}`);
  }
  return { tokens, set: new Set(tokens), joined };
}

export function hasKeyword(index: KeywordIndex, token: string): boolean {
  if (index.set.has(token) || index.joined.has(token)) return true;
  if (token.length < MIN_TYPO_LENGTH || /\d/.test(token)) return false;
  for (const candidate of index.set) {
    if (candidate.length < MIN_TYPO_LENGTH - 1 || candidate[0] !== token[0]) continue;
    if (oneEditApart(token, candidate)) return true;
  }
  return false;
}

export type KeywordMatch = {
  /** Weighted share of the question's content words found in the snippet. 0 to 1. */
  coverage: number;
};

export type KeywordScorer = {
  /** Content words in the question. A question with none cannot be matched by keyword. */
  terms: string[];
  /** Content words that no snippet in the pool contains. */
  unknown: string[];
  score(snippet: string): KeywordMatch;
};

/**
 * Scores snippets against one question.
 * A word found in few snippets counts for more than a word found in most of them,
 * and a word found in none of them counts the most. That is what pulls the score
 * down when the question is about something the notes never mention.
 */
export function keywordScorer(message: string, pool: string[]): KeywordScorer {
  const terms = [...new Set(keywordTokens(message))];
  const indexes = new Map<string, KeywordIndex>();
  const indexOf = (snippet: string): KeywordIndex => {
    let index = indexes.get(snippet);
    if (!index) {
      index = indexKeywords(snippet);
      indexes.set(snippet, index);
    }
    return index;
  };
  const size = pool.length;
  const weights = new Map<string, number>();
  const unknown: string[] = [];
  for (const term of terms) {
    let found = 0;
    for (const snippet of pool) if (hasKeyword(indexOf(snippet), term)) found += 1;
    if (found === 0) unknown.push(term);
    weights.set(term, Math.log(1 + (size - found + 0.5) / (found + 0.5)));
  }
  const total = terms.reduce((sum, term) => sum + (weights.get(term) ?? 0), 0);
  return {
    terms,
    unknown,
    score(snippet: string): KeywordMatch {
      const index = indexOf(snippet);
      if (terms.length === 0 || total === 0) return { coverage: 0 };
      let hit = 0;
      for (const term of terms) if (hasKeyword(index, term)) hit += weights.get(term) ?? 0;
      return { coverage: hit / total };
    },
  };
}
