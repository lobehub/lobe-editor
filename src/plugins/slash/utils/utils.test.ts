import { describe, expect, it } from 'vitest';

import { getBasicTypeaheadTriggerMatch } from './utils';

describe('getBasicTypeaheadTriggerMatch', () => {
  describe('@ mentions in CJK text', () => {
    it.each([
      ['帮我@', 2, '@'],
      ['帮我@产品经理', 2, '@产品经理'],
      ['好的，@产品', 3, '@产品'],
      ['これは@田中', 3, '@田中'],
      ['＠产品', 0, '＠产品'],
      ['你好＠', 2, '＠'],
      ['@产品', 0, '@产品'],
      ['hi @pm', 3, '@pm'],
    ])('opens for %s', (text, leadOffset, replaceableString) => {
      expect(getBasicTypeaheadTriggerMatch('@', {})(text)).toMatchObject({
        leadOffset,
        replaceableString,
      });
    });

    it.each(['mail a@b.com', 'abc@'])('stays closed after a Latin word: %s', (text) => {
      expect(getBasicTypeaheadTriggerMatch('@', {})(text)).toBeNull();
    });

    it('keeps whitespace-allowed matching for CJK text', () => {
      expect(
        getBasicTypeaheadTriggerMatch('@', { allowWhitespace: true })('请@产品 经理'),
      ).toMatchObject({ leadOffset: 1, matchingString: '产品 经理' });
    });
  });

  it('keeps other triggers unchanged', () => {
    const match = getBasicTypeaheadTriggerMatch('/', {});
    expect(match('和/或')).toBeNull();
    expect(match('/cmd')).toMatchObject({ leadOffset: 0, matchingString: 'cmd' });
  });
});
