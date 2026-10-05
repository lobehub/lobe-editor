import { resetRandomKey } from 'lexical';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

type SerializedRecord = {
  children?: SerializedRecord[];
  id?: number | string;
  text?: string;
  type?: string;
  $?: { properties?: Record<string, unknown> };
  [key: string]: unknown;
};

type ImportedDocument = {
  root: SerializedRecord;
};

const editors: IEditor[] = [];

function createEditor(): IEditor {
  const editor = Editor.createEditor();
  editor.registerPlugins([CommonPlugin, MarkdownPlugin]);
  editor.initNodeEditor();
  editors.push(editor);
  return editor;
}

function serializedRoot(editor: IEditor): SerializedRecord {
  return (editor.getDocument('json') as unknown as { root: SerializedRecord }).root;
}

function allNodes(node: SerializedRecord): SerializedRecord[] {
  return [node, ...(node.children ?? []).flatMap(allNodes)];
}

function nodeId(node: SerializedRecord): string | undefined {
  const id = node.$?.properties?.nodeId;
  return typeof id === 'string' ? id : undefined;
}

function findNode(
  root: SerializedRecord,
  predicate: (node: SerializedRecord) => boolean,
): SerializedRecord | undefined {
  if (predicate(root)) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return undefined;
}

function mockRandomBytes(values: number[][]) {
  let call = 0;
  return vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    const value = values[call] ?? values.at(-1) ?? [0];
    call += 1;
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = value[index % value.length];
    }
    return array;
  });
}

function paragraphWithMissingTextId(paragraphId: string): ImportedDocument {
  return {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text: 'missing identity',
              type: 'text',
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          id: paragraphId,
          indent: 0,
          type: 'paragraph',
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  };
}

function explicitLegacyIds(): ImportedDocument {
  return {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              id: 9_007_199_254_740_991,
              mode: 'normal',
              style: '',
              text: 'numeric legacy ID',
              type: 'text',
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          id: 'legacy-paragraph-id-that-is-much-longer-than-ten-characters',
          indent: 0,
          type: 'paragraph',
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  };
}

describe('CommonPlugin short node IDs', () => {
  beforeEach(() => {
    resetRandomKey();
  });

  afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
    vi.restoreAllMocks();
  });

  it('generates unique ten-character lowercase base36 IDs', () => {
    mockRandomBytes([[0], [1]]);
    const editor = createEditor();
    editor.setDocument('markdown', 'Generated ID');

    const ids = allNodes(serializedRoot(editor))
      .map(nodeId)
      .filter((id): id is string => Boolean(id));

    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => /^[0-9a-z]{10}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rejects crypto bytes above the unbiased base36 range', () => {
    const getRandomValues = mockRandomBytes([[252, 253, 254, 255], [1], [2]]);
    const editor = createEditor();
    editor.setDocument('markdown', 'Rejected bytes');

    const ids = allNodes(serializedRoot(editor))
      .map(nodeId)
      .filter((id): id is string => Boolean(id));

    expect(getRandomValues).toHaveBeenCalledTimes(3);
    expect(ids).toContain('1111111111');
    expect(ids).toContain('2222222222');
    expect(ids.every((id) => /^[0-9a-z]{10}$/.test(id))).toBe(true);
  });

  it('retries when a generated candidate collides with an imported ID', () => {
    const getRandomValues = mockRandomBytes([[10], [11]]);
    const editor = createEditor();
    editor.setDocument('json', paragraphWithMissingTextId('aaaaaaaaaa'), { keepId: true });

    const root = serializedRoot(editor);
    const paragraph = root.children?.[0];
    const text = findNode(root, (node) => node.text === 'missing identity');

    expect(paragraph && nodeId(paragraph)).toBe('aaaaaaaaaa');
    expect(text && nodeId(text)).toBe('bbbbbbbbbb');
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it('preserves imported long string IDs and valid numeric IDs', () => {
    const getRandomValues = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation(() => {
        throw new Error('Complete imported IDs should not be regenerated.');
      });
    const editor = createEditor();
    const input = explicitLegacyIds();
    const inputBefore = structuredClone(input);
    editor.setDocument('json', input as Parameters<IEditor['setDocument']>[1], { keepId: true });

    const root = serializedRoot(editor);
    const paragraph = root.children?.[0];
    const text = findNode(root, (node) => node.text === 'numeric legacy ID');

    expect(paragraph && nodeId(paragraph)).toBe(
      'legacy-paragraph-id-that-is-much-longer-than-ten-characters',
    );
    expect(text && nodeId(text)).toBe('9007199254740991');
    expect(getRandomValues).not.toHaveBeenCalled();
    expect(input).toEqual(inputBefore);
  });
});
