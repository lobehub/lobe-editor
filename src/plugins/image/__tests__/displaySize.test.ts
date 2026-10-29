import { $getRoot } from 'lexical';
import { describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { $isBlockImageNode, type BlockImageNode } from '../node/block-image-node';
import { ImagePlugin } from '../plugin';
import { getImageDisplaySize } from '../utils/displaySize';

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?><root>';

function createEditor(): IEditor {
  const editor = Editor.createEditor();
  editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, ImagePlugin]);
  editor.initNodeEditor();
  return editor;
}

function firstBlockImage(editor: IEditor): BlockImageNode {
  let found: BlockImageNode | undefined;
  editor
    .getLexicalEditor()!
    .getEditorState()
    .read(() => {
      found = $getRoot()
        .getChildren()
        .find((node) => $isBlockImageNode(node)) as BlockImageNode | undefined;
    });
  if (!found) throw new Error('no block image');
  return found;
}

describe('getImageDisplaySize', () => {
  it('treats displayWidth as the percent tier', () => {
    expect(getImageDisplaySize({ displayWidth: 75, width: 560 })).toEqual({
      mode: 'percent',
      value: 75,
    });
  });

  it('treats a numeric width as the px tier', () => {
    expect(getImageDisplaySize({ width: 560 })).toEqual({ mode: 'px', px: 560 });
  });

  it('is auto for inherit or zero width', () => {
    expect(getImageDisplaySize({ width: 'inherit' })).toEqual({ mode: 'auto' });
    expect(getImageDisplaySize({ width: 0 })).toEqual({ mode: 'auto' });
  });
});

describe('image displayWidth', () => {
  it('reads display-width from litexml and writes it back', () => {
    const editor = createEditor();
    editor.setDocument(
      'litexml',
      `${XML_HEAD}<img block="true" src="https://cdn/a.png" alt="a" display-width="75"></img></root>`,
    );
    expect(firstBlockImage(editor).displayWidth).toBe(75);
    expect(editor.getDocument('litexml') as unknown as string).toContain('display-width="75"');
  });

  it('keeps displayWidth through json', () => {
    const editor = createEditor();
    editor.setDocument(
      'litexml',
      `${XML_HEAD}<img block="true" src="https://cdn/a.png" alt="a" display-width="40"></img></root>`,
    );
    const json = editor.getDocument('json') as any;
    const second = createEditor();
    second.setDocument('json', json);
    expect(firstBlockImage(second).displayWidth).toBe(40);
  });

  it('setDisplaySize switches tiers and clears the other one', () => {
    const editor = createEditor();
    editor.setDocument(
      'litexml',
      `${XML_HEAD}<img block="true" src="https://cdn/a.png" alt="a" width="560"></img></root>`,
    );
    const lexical = editor.getLexicalEditor()!;
    lexical.update(() => firstBlockImage(editor).setDisplaySize({ mode: 'percent', value: 50 }), {
      discrete: true,
    });
    let node = firstBlockImage(editor);
    expect(node.displayWidth).toBe(50);
    expect(node.width).toBe('inherit');

    lexical.update(() => firstBlockImage(editor).setDisplaySize({ mode: 'px', px: 320 }), {
      discrete: true,
    });
    node = firstBlockImage(editor);
    expect(node.displayWidth).toBeUndefined();
    expect(node.width).toBe(320);
  });
});
