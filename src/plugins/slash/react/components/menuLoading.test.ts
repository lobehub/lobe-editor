import { describe, expect, it } from 'vitest';

import { shouldShowLoadingPlaceholder } from './menuLoading';

describe('shouldShowLoadingPlaceholder', () => {
  it('keeps rendering previous results while the next query loads', () => {
    const previousResults = [{ key: 'file-a', label: 'file-a.ts' }];

    expect(shouldShowLoadingPlaceholder(true, previousResults)).toBe(false);
  });

  it('allows a loading placeholder when no previous result exists', () => {
    expect(shouldShowLoadingPlaceholder(true, [])).toBe(true);
  });
});
