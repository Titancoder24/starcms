/**
 * Flesch Reading Ease score.
 * Higher = easier to read. ≥ 50 is the default minimum.
 */
export function fleschReadingEase(text: string): number {
  const sentences = countSentences(text);
  const words = countWords(text);
  const syllables = countSyllables(text);

  if (sentences === 0 || words === 0) return 0;

  const avgWordsPerSentence = words / sentences;
  const avgSyllablesPerWord = syllables / words;

  return 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
}

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function countSentences(text: string): number {
  const matches = text.match(/[.!?]+/g);
  return matches ? matches.length : 1;
}

function countSyllables(text: string): number {
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) ?? [];
  return words.reduce((total, word) => total + syllablesInWord(word), 0);
}

function syllablesInWord(word: string): number {
  word = word.replace(/(?:[^laeiouy]|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

export function wordCount(mdx: string): number {
  // Strip MDX/HTML tags and count words
  const text = mdx
    .replace(/<[^>]+>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/[#*_~\[\]()>]/g, " ");
  return countWords(text);
}
