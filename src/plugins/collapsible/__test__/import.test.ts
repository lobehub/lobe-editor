import { $getHtmlContent, $insertDataTransferForRichText } from '@lexical/clipboard';
import {
  $createNodeSelection,
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $setSelection,
} from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { CollapsiblePlugin } from '../plugin';

describe('collapsible import', () => {
  let editor: IEditor;

  beforeEach(() => {
    editor = Editor.createEditor();
    editor.registerPlugins([MarkdownPlugin, CommonPlugin, CollapsiblePlugin]);
    editor.initNodeEditor();
  });

  it.each([
    '<details><summary>More</summary>Hidden **text**</details>',
    '<details>\n<summary>More</summary>\nHidden **text**\n</details>',
    '<details>\n<summary>More</summary>\n\nHidden **text**\n</details>',
  ])('imports title and formatted body from %s', (markdown) => {
    editor.setDocument('markdown', markdown);
    const node = (editor.getDocument('json') as any).root.children[0];

    expect(node.type).toBe('collapsible');
    expect(node.title).toBe('More');
    expect(node.collapsed).toBe(true);
    expect(node.children).toHaveLength(2);
    expect(node.children[0].children[0].text).toBe('More');
    expect(node.children[1].children).toEqual([
      expect.objectContaining({ text: 'Hidden ' }),
      expect.objectContaining({ format: 1, text: 'text' }),
    ]);
  });

  it('keeps nested details inside their parent and decodes summary entities', () => {
    editor.setDocument(
      'markdown',
      '<details open=""><summary>A &amp; B</summary>Outer\n\n<details><summary>Inner</summary>Body</details>\n</details>\n\nAfter',
    );
    const nodes = (editor.getDocument('json') as any).root.children;

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ collapsed: false, title: 'A & B', type: 'collapsible' });
    expect(nodes[0].children[2]).toMatchObject({ title: 'Inner', type: 'collapsible' });
    expect(nodes[0].children[2].children[1].children[0].text).toBe('Body');
    expect(nodes[1].children[0].text).toBe('After');
  });

  it('keeps HTML paragraphs and emphasis in a compact details block', () => {
    editor.setDocument(
      'markdown',
      '<details><summary>More</summary><p>Hidden <strong>text</strong></p></details>',
    );
    const node = (editor.getDocument('json') as any).root.children[0];

    expect(node.children).toHaveLength(2);
    expect(node.children[1]).toMatchObject({ type: 'paragraph' });
    expect(node.children[1].children).toEqual([
      expect.objectContaining({ text: 'Hidden ' }),
      expect.objectContaining({ format: 1, text: 'text' }),
    ]);
  });

  it('keeps sibling details separate and respects quoted attributes', () => {
    editor.setDocument(
      'markdown',
      '<details title="a > b open"><summary>First</summary>First</details><details open="false"><summary>Second</summary>Body</details>',
    );
    const nodes = (editor.getDocument('json') as any).root.children;
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ collapsed: true, title: 'First' });
    expect(nodes[0].children[1].children[0].text).toBe('First');
    expect(nodes[1]).toMatchObject({ collapsed: false, title: 'Second' });
  });

  it.each([
    ['<details><summary>More</summary>Body</details>', 'More'],
    ['<details>Body</details>', 'Details'],
  ])('imports bare HTML body text as an editable paragraph: %s', (html, title) => {
    const lexical = editor.getLexicalEditor()!;
    lexical.update(
      () => {
        $getRoot().clear().append($createParagraphNode());
        $getRoot().selectEnd();
        $insertDataTransferForRichText(
          { getData: (type: string) => (type === 'text/html' ? html : '') } as DataTransfer,
          $getSelection()!,
          lexical,
        );
      },
      { discrete: true },
    );
    const node = (editor.getDocument('json') as any).root.children[0];
    expect(node.title).toBe(title);
    expect(node.children[1]).toMatchObject({
      type: 'paragraph',
      children: [expect.objectContaining({ text: 'Body' })],
    });
  });

  it('round-trips HTML without duplicating the title or consuming the first body paragraph', () => {
    const lexical = editor.getLexicalEditor()!;
    const paste = (html: string) => {
      lexical.update(
        () => {
          $getRoot().clear().append($createParagraphNode());
          $getRoot().selectEnd();
          $insertDataTransferForRichText(
            { getData: (type: string) => (type === 'text/html' ? html : '') } as DataTransfer,
            $getSelection()!,
            lexical,
          );
        },
        { discrete: true },
      );
    };
    paste('<details open><summary>More</summary><p>More</p><p>Body</p></details>');
    let html = '';
    lexical.update(
      () => {
        const selection = $createNodeSelection();
        const block = $getRoot().getFirstChild()!;
        selection.add(block.getKey());
        if ($isElementNode(block)) {
          block.getChildren().forEach((node) => selection.add(node.getKey()));
          block.getAllTextNodes().forEach((node) => selection.add(node.getKey()));
        }
        $setSelection(selection);
        html = $getHtmlContent(lexical, $getSelection())!;
      },
      { discrete: true },
    );
    expect(html).toContain('<details');
    paste(html);

    const node = (editor.getDocument('json') as any).root.children[0];
    expect(node).toMatchObject({ collapsed: false, title: 'More', type: 'collapsible' });
    expect(
      node.children.map((child: any) => child.children.map((text: any) => text.text).join('')),
    ).toEqual(['More', 'More', 'Body']);
  });

  it.each([false, true])(
    'replaces a selected or empty collapsible when pasting details (empty: %s)',
    (empty) => {
      editor.setDocument(
        'markdown',
        empty
          ? '<details><summary></summary></details>'
          : '<details><summary>Old</summary>Old body</details>',
      );
      const lexical = editor.getLexicalEditor()!;
      lexical.update(
        () => {
          const block = $getRoot().getFirstChild()!;
          if (!$isElementNode(block)) throw new Error('Expected collapsible element');
          if (empty) block.getFirstChild()!.selectStart();
          else block.select(0, block.getChildrenSize());
          $insertDataTransferForRichText(
            {
              getData: (type: string) =>
                type === 'text/html'
                  ? '<details open><summary>New</summary><p>New body</p></details>'
                  : '',
            } as DataTransfer,
            $getSelection()!,
            lexical,
          );
        },
        { discrete: true },
      );
      const nodes = (editor.getDocument('json') as any).root.children;
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({ title: 'New', collapsed: false, type: 'collapsible' });
      expect(nodes[0].children[1].children[0].text).toBe('New body');
    },
  );
});
