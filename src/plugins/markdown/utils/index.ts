import { $isTextNode, LexicalNode, TextNode } from 'lexical';

/**
 * Returns true if the node can contain transformable markdown.
 * Code nodes cannot contain transformable markdown.
 * For example, `code **bold**` should not be transformed to
 * <code>code <strong>bold</strong></code>.
 */
export function canContainTransformableMarkdown(node: LexicalNode | undefined): node is TextNode {
  return $isTextNode(node) && !node.hasFormat('code');
}

export function isEqualSubString(
  stringA: string,
  aStart: number,
  stringB: string,
  bStart: number,
  length: number,
): boolean {
  for (let i = 0; i < length; i++) {
    if (stringA[aStart + i] !== stringB[bStart + i]) {
      return false;
    }
  }

  return true;
}

// eslint-disable-next-line unicorn/better-regex
export const PUNCTUATION_OR_SPACE = /[!-/:-@[-`{-~\s]/;

export function getOpenTagStartIndex(string: string, maxIndex: number, tag: string): number {
  const tagLength = tag.length;

  for (let i = maxIndex; i >= tagLength; i--) {
    const startIndex = i - tagLength;

    if (
      isEqualSubString(string, startIndex, tag, 0, tagLength) && // Space after opening tag cancels transformation
      string[startIndex + tagLength] !== ' '
    ) {
      return startIndex;
    }
  }

  return -1;
}

export function indexBy<T>(
  list: Array<T>,
  callback: (arg0: T) => string | undefined,
): Readonly<Record<string, Array<T>>> {
  const index: Record<string, Array<T>> = {};

  for (const item of list) {
    const key = callback(item);

    if (!key) {
      continue;
    }

    if (index[key]) {
      index[key].push(item);
    } else {
      index[key] = [item];
    }
  }

  return index;
}

let Punctuation = /[!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~\u00A1\u2010-\u2027-]/;
try {
  Punctuation = new RegExp('[\\p{Pc}|\\p{Pd}|\\p{Pe}|\\p{Pf}|\\p{Pi}|\\p{Po}|\\p{Ps}]', 'u');
} catch {}

/**
 * Checks if a character is a punctuation character.
 * @param char The character to check.
 * @returns True if the character is a punctuation character, false otherwise.
 */
export function isPunctuationChar(char: string): boolean {
  return Punctuation.test(char);
}
