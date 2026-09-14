import { describe, expect, it } from 'vitest';

import {
  canonicalizeMarkdownRewriteText,
  getSerializedTextContent,
  hashRewriteText,
  normalizeRewriteText,
} from '../rewrite-text';

describe('rewrite text helpers', () => {
  it('normalizes all line endings to the composer separator', () => {
    expect(normalizeRewriteText('first\nsecond\r\nthird\rfourth')).toBe(
      'first second third fourth',
    );
  });

  it('keeps normalized rewrite hashes deterministic across line endings', () => {
    expect(hashRewriteText('Hello\nworld')).toBe('fnv1a-594d29c7');
    expect(hashRewriteText('Hello\r\nworld')).toBe(hashRewriteText('Hello\nworld'));
  });

  it('projects parsed Markdown text without structural markers or cursor sentinels', () => {
    const parsed = {
      children: [
        {
          children: [
            { format: 1, text: 'Bold', type: 'text' },
            { format: 16, text: 'sort', type: 'text' },
          ],
          type: 'paragraph',
        },
        {
          children: [
            { children: [{ text: '\uFEFF', type: 'cursor' }], type: 'listitem' },
            { children: [{ text: 'Second', type: 'text' }], type: 'listitem' },
          ],
          type: 'list',
        },
      ],
      type: 'root',
    };

    expect(getSerializedTextContent(parsed)).toBe('BoldsortSecond');
    expect(canonicalizeMarkdownRewriteText('**Bold** `sort`\n- Second', () => parsed)).toBe(
      'BoldsortSecond',
    );
  });
});
