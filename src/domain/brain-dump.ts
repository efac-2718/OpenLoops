/**
 * Splitting a brain dump, typed or spoken through the keyboard's mic, into
 * separate thoughts: one per line, and one per sentence within a line.
 *
 * Written without regex lookbehind so it runs on every JavaScript engine the
 * app ships to.
 */

/** Words that end in a full stop without ending the sentence ("Dr. Patel"). */
const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'vs', 'etc', 'e.g', 'i.e', 'approx']);

/** A bullet or number at the start of a line: "- ", "* ", "• ", "1. ", "2) ". */
const LIST_MARKER = /^\s*(?:[-*•]|\d+[.)])\s+/;

/** Sentence-ending punctuation, any closing quotes or brackets, then whitespace. */
const SENTENCE_END = /[.!?]+["”’')\]]*\s+/g;

export function splitBrainDump(text: string): string[] {
  const thoughts: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const content = line.replace(LIST_MARKER, '').trim();
    if (content) thoughts.push(...splitSentences(content));
  }
  return thoughts.map(tidy).filter((thought) => thought.length > 0);
}

function splitSentences(line: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (const match of line.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    const sentence = line.slice(start, match.index + match[0].trimEnd().length);
    if (startsNewSentence(line[end]) && !endsWithAbbreviation(sentence)) {
      sentences.push(sentence);
      start = end;
    }
  }
  sentences.push(line.slice(start));
  return sentences;
}

/**
 * A new sentence starts with anything but a lowercase letter: a capital, a
 * digit, a quote, or a letter from a script without case.
 */
function startsNewSentence(char: string | undefined): boolean {
  if (char === undefined) return false;
  const isLowercase = char === char.toLowerCase() && char !== char.toUpperCase();
  return !isLowercase;
}

function endsWithAbbreviation(sentence: string): boolean {
  const lastWord = sentence.trimEnd().split(/\s+/).pop() ?? '';
  return lastWord.endsWith('.') && ABBREVIATIONS.has(lastWord.slice(0, -1).toLowerCase());
}

/** Collapses spaces and drops a single closing full stop: "Call mum." becomes "Call mum". */
function tidy(thought: string): string {
  const collapsed = thought.replace(/\s+/g, ' ').trim();
  return collapsed.endsWith('.') && !collapsed.endsWith('..') ? collapsed.slice(0, -1) : collapsed;
}
