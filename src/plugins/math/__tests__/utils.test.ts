import { describe, expect, it } from 'vitest';

import { isLikelyMathContent } from '../utils';

describe('isLikelyMathContent', () => {
  it.each([
    ['x', 'single variable'],
    ['E=mc^2', 'classic formula'],
    ['a + b', 'operator'],
    ['\\alpha', 'LaTeX command'],
    ['\\frac{1}{2}', 'LaTeX structure'],
    ['x^2', 'superscript'],
    ['n_0', 'subscript'],
    ['f(x)', 'function call'],
    ['2x + 3', 'digits with operator'],
    ['a < b', 'relation'],
    ['n!', 'factorial'],
    ['a,b,c', 'comma-separated list'],
    ['|x|', 'absolute value'],
    ['a/b', 'fraction'],
    ['x*y', 'multiplication'],
  ])('should detect %s as math (%s)', (input) => {
    expect(isLikelyMathContent(input)).toBe(true);
  });

  it.each([
    ['hello', 'single word'],
    ['name', 'single word'],
    ['javascript', 'long word'],
    ['中文', 'CJK text'],
    ['hello world', 'plain sentence'],
    ['some content here', 'multi-word text'],
    ['The price', 'English phrase'],
    ['makes the whole line italic', 'long sentence'],
    ['', 'empty string'],
    ['  ', 'whitespace only'],
  ])('should reject %s as non-math (%s)', (input) => {
    expect(isLikelyMathContent(input)).toBe(false);
  });
});
