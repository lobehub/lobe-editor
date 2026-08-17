import { describe, expect, it } from 'vitest';

import { resolveBlockMenuTop } from './menu-position';

describe('resolveBlockMenuTop', () => {
  it('centers the menu against the first line of a multiline paragraph', () => {
    expect(
      resolveBlockMenuTop({
        anchorTop: 100,
        blockHeight: 76.8,
        blockTagName: 'P',
        lineHeight: '25.6px',
        menuHeight: 31,
      }),
    ).toBeCloseTo(97.3);
  });

  it.each([
    ['H1', '38px', 103.5],
    ['H2', '32px', 100.5],
  ])('centers the menu for %s headings', (blockTagName, lineHeight, expectedTop) => {
    expect(
      resolveBlockMenuTop({
        anchorTop: 100,
        blockHeight: Number.parseFloat(lineHeight),
        blockTagName,
        lineHeight,
        menuHeight: 31,
      }),
    ).toBe(expectedTop);
  });

  it('keeps the optical fallback for complex blocks', () => {
    expect(
      resolveBlockMenuTop({
        anchorTop: 100,
        blockHeight: 200,
        blockTagName: 'DIV',
        lineHeight: '25.6px',
        menuHeight: 31,
      }),
    ).toBe(98);
  });

  it('keeps the optical fallback when line-height is not measurable', () => {
    expect(
      resolveBlockMenuTop({
        anchorTop: 100,
        blockHeight: 38,
        blockTagName: 'H1',
        lineHeight: 'normal',
        menuHeight: 31,
      }),
    ).toBe(98);
  });
});
