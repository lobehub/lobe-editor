import { describe, expect, it } from 'vitest';

import { getBasicTypeaheadTriggerMatch } from '../utils';

describe('slash utils', () => {
  describe('getBasicTypeaheadTriggerMatch', () => {
    it('allows hyphenated slash queries', () => {
      const match = getBasicTypeaheadTriggerMatch('/', {})('/agent-');

      expect(match).toMatchObject({
        leadOffset: 0,
        matchingString: 'agent-',
        replaceableString: '/agent-',
      });
    });

    it('keeps punctuation such as colon as query terminators', () => {
      const match = getBasicTypeaheadTriggerMatch('/', {})('/agent:');

      expect(match).toBeNull();
    });
  });
});
