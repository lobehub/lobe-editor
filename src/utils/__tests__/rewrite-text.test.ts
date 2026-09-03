import { describe, expect, it } from 'vitest';

import { hashRewriteText, normalizeRewriteText } from '../rewrite-text';

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
});
