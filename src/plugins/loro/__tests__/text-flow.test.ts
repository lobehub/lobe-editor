// @vitest-environment node
import { LoroDoc } from 'loro-crdt';
import { describe, expect, it } from 'vitest';

import {
  LORO_FORMAT_PREFIX,
  readLoroFlow,
  updateLoroFlow,
  type LexicalFlowSnapshot,
} from '../index';

const snapshot = (text: string, attributes?: Record<string, unknown>): LexicalFlowSnapshot => ({
  delta: [{ insert: text, ...(attributes ? { attributes } : {}) }],
  text,
});

describe('Loro text-flow mark patching', () => {
  it('keeps seed marks while each peer uses its own cached flow for a style and insertion', () => {
    const seed = new LoroDoc();
    seed.setPeerId('5101');
    seed.configTextStyle({
      lexical_format_bold: { expand: 'after' },
      lexical_style: { expand: 'after' },
    });
    const seedText = seed.getText('flow');
    seedText.insert(0, 'hello world');
    seedText.mark({ start: 0, end: 5 }, `${LORO_FORMAT_PREFIX}bold`, true);
    seed.commit();

    const a = LoroDoc.fromSnapshot(seed.export({ mode: 'snapshot' }));
    const b = LoroDoc.fromSnapshot(seed.export({ mode: 'snapshot' }));
    a.setPeerId('5102');
    b.setPeerId('5103');
    a.configTextStyle({
      lexical_format_bold: { expand: 'after' },
      lexical_style: { expand: 'after' },
    });
    b.configTextStyle({
      lexical_format_bold: { expand: 'after' },
      lexical_style: { expand: 'after' },
    });

    const before = readLoroFlow(a.getText('flow'));
    const nextA: LexicalFlowSnapshot = {
      delta: [
        { insert: 'hello', attributes: { [`${LORO_FORMAT_PREFIX}bold`]: true } },
        { insert: ' world', attributes: { lexical_style: 'color:red' } },
      ],
      text: 'hello world',
    };
    updateLoroFlow(a, a.getText('flow'), nextA, before);
    a.commit();

    const beforeB = readLoroFlow(b.getText('flow'));
    const nextB: LexicalFlowSnapshot = {
      delta: [
        { insert: 'hello', attributes: { [`${LORO_FORMAT_PREFIX}bold`]: true } },
        { insert: ' world' },
        { insert: '!' },
      ],
      text: 'hello world!',
    };
    updateLoroFlow(b, b.getText('flow'), nextB, beforeB);
    b.commit();
    const seedVersion = seed.version();

    const updateA = a.export({ mode: 'update', from: seedVersion });
    const updateB = b.export({ mode: 'update', from: seedVersion });
    a.import(updateB);
    b.import(updateA);
    a.import(updateB); // duplicate update must not alter the mark patch.

    expect(a.getText('flow').toString()).toBe('hello world!');
    expect(a.getText('flow').toDelta()).toEqual(b.getText('flow').toDelta());
    expect(a.getText('flow').toDelta()).toEqual([
      { insert: 'hello', attributes: { [`${LORO_FORMAT_PREFIX}bold`]: true } },
      { insert: ' world', attributes: { lexical_style: 'color:red' } },
      { insert: '!' },
    ]);
  });

  it('preserves a new concurrent mark when the other peer inserts through the old cache', () => {
    const seed = new LoroDoc();
    seed.setPeerId('5151');
    seed.configTextStyle({ lexical_format_bold: { expand: 'after' } });
    const seedText = seed.getText('flow');
    seedText.insert(0, 'hello world');
    seed.commit();
    const snapshotBytes = seed.export({ mode: 'snapshot' });
    const a = LoroDoc.fromSnapshot(snapshotBytes);
    const b = LoroDoc.fromSnapshot(snapshotBytes);
    a.setPeerId('5152');
    b.setPeerId('5153');
    a.configTextStyle({ lexical_format_bold: { expand: 'after' } });
    b.configTextStyle({ lexical_format_bold: { expand: 'after' } });
    const version = seed.version();

    const oldA = readLoroFlow(a.getText('flow'));
    updateLoroFlow(
      a,
      a.getText('flow'),
      snapshot('hello world', { [`${LORO_FORMAT_PREFIX}bold`]: true }),
      oldA,
    );
    a.commit();

    const oldB = readLoroFlow(b.getText('flow'));
    updateLoroFlow(
      b,
      b.getText('flow'),
      { delta: [{ insert: 'hello world!' }], text: 'hello world!' },
      oldB,
    );
    b.commit();
    const updateA = a.export({ mode: 'update', from: version });
    const updateB = b.export({ mode: 'update', from: version });
    a.import(updateB);
    b.import(updateA);

    expect(a.getText('flow').toDelta()).toEqual(b.getText('flow').toDelta());
    expect(a.getText('flow').toDelta()[0]).toMatchObject({
      attributes: { [`${LORO_FORMAT_PREFIX}bold`]: true },
    });
  });

  it('aligns two separated insertions without overwriting a remote middle mark', () => {
    const seed = new LoroDoc();
    seed.setPeerId('5161');
    seed.configTextStyle({ lexical_format_bold: { expand: 'after' } });
    const text = seed.getText('flow');
    text.insert(0, 'abcdef');
    seed.commit();
    const snapshotBytes = seed.export({ mode: 'snapshot' });
    const a = LoroDoc.fromSnapshot(snapshotBytes);
    const b = LoroDoc.fromSnapshot(snapshotBytes);
    a.setPeerId('5162');
    b.setPeerId('5163');
    a.configTextStyle({ lexical_format_bold: { expand: 'after' } });
    b.configTextStyle({ lexical_format_bold: { expand: 'after' } });
    const version = seed.version();

    const oldA = readLoroFlow(a.getText('flow'));
    updateLoroFlow(
      a,
      a.getText('flow'),
      { delta: [{ insert: 'aXbcdefY' }], text: 'aXbcdefY' },
      oldA,
    );
    a.commit();

    const oldB = readLoroFlow(b.getText('flow'));
    updateLoroFlow(
      b,
      b.getText('flow'),
      {
        delta: [
          { insert: 'ab' },
          { insert: 'cd', attributes: { [`${LORO_FORMAT_PREFIX}bold`]: true } },
          { insert: 'ef' },
        ],
        text: 'abcdef',
      },
      oldB,
    );
    b.commit();

    a.import(b.export({ mode: 'update', from: version }));
    b.import(a.export({ mode: 'update', from: version }));
    expect(a.getText('flow').toString()).toBe('aXbcdefY');
    expect(a.getText('flow').toDelta()).toEqual(b.getText('flow').toDelta());
    expect(a.getText('flow').toDelta()).toContainEqual({
      insert: 'cd',
      attributes: { [`${LORO_FORMAT_PREFIX}bold`]: true },
    });
  });

  it('patches an unrelated style range without rewriting text', () => {
    const doc = new LoroDoc();
    doc.setPeerId('5201');
    const text = doc.getText('flow');
    text.insert(0, 'hello');
    doc.commit();
    const before = readLoroFlow(text);

    const next = snapshot('hello', { lexical_style: 'color:red' });
    updateLoroFlow(doc, text, next, before);
    doc.commit();

    expect(text.toString()).toBe('hello');
    expect(text.toDelta()).toEqual([
      { insert: 'hello', attributes: { lexical_style: 'color:red' } },
    ]);
  });
});
