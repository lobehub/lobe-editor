import { $createTextNode, $getRoot, $isElementNode, IS_BOLD, IS_UNDERLINE } from 'lexical';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { $setNodeId } from '@/plugins/common/node/node-id';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { IEditor } from '@/types';

describe('Common Plugin Tests', () => {
  let kernel: IEditor;

  beforeEach(() => {
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin]);
    kernel.initNodeEditor();
  });

  it('should markdown reader work', () => {
    kernel.setDocument('markdown', 'this is <ins>underline</ins> and this is <u>underline2</u>');
    const { root } = kernel.getDocument('json') as any;

    expect(root.children.length).toBe(1);
    expect(root.children[0].type).toBe('paragraph');
    expect(root.children[0].children.length).toBe(4);

    expect(root.children[0].children[0].text).toBe('this is ');
    expect(root.children[0].children[0].format).toBe(0);

    expect(root.children[0].children[1].text).toBe('underline');
    expect(root.children[0].children[1].format & IS_UNDERLINE).toBe(IS_UNDERLINE);

    expect(root.children[0].children[2].text).toBe(' and this is ');
    expect(root.children[0].children[2].format).toBe(0);

    expect(root.children[0].children[3].text).toBe('underline2');
    expect(root.children[0].children[3].format & IS_UNDERLINE).toBe(IS_UNDERLINE);
  });

  it('should markdown html mix markdown work', () => {
    kernel.setDocument('markdown', 'this is <ins>**strong**</ins>');
    const { root } = kernel.getDocument('json') as any;

    expect(root.children.length).toBe(1);
    expect(root.children[0].type).toBe('paragraph');
    expect(root.children[0].children.length).toBe(2);

    expect(root.children[0].children[0].text).toBe('this is ');
    expect(root.children[0].children[0].format).toBe(0);

    expect(root.children[0].children[1].text).toBe('strong');
    expect(root.children[0].children[1].format & IS_UNDERLINE).toBe(IS_UNDERLINE);
    expect(root.children[0].children[1].format & IS_BOLD).toBe(IS_BOLD);
  });

  it('writes adjacent same-format text nodes as one Markdown span without merging node ids', async () => {
    kernel.setDocument('markdown', 'placeholder');
    const editor = kernel.getLexicalEditor()!;

    editor.update(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      if (!$isElementNode(paragraph)) throw new Error('paragraph missing');

      const head = $createTextNode('He').setFormat('bold');
      const replacement = $createTextNode('X').setFormat('bold');
      const tail = $createTextNode('orld');
      $setNodeId(head, 'text-head');
      $setNodeId(replacement, 'text-replacement');
      $setNodeId(tail, 'text-tail');
      paragraph.clear();
      paragraph.append(head, replacement, tail);
    });
    await moment();

    expect(kernel.getDocument('markdown')).toBe('**HeX**orld\n');

    const { root } = kernel.getDocument('json') as any;
    const textNodes = root.children[0].children;
    expect(textNodes.map((node: { text: string }) => node.text)).toEqual(['He', 'X', 'orld']);
    const nodeIds = textNodes.map(
      (node: { $?: { properties?: { nodeId?: string } } }) => node.$?.properties?.nodeId,
    );
    expect(nodeIds.every((nodeId: unknown) => typeof nodeId === 'string')).toBe(true);
    expect(new Set(nodeIds).size).toBe(textNodes.length);
  });
});
