import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from 'lexical';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { FOOTNOTE_JUMP_TO_DEFINITION_COMMAND } from '../command';
import { $createFootnoteDefinitionNode } from '../node/FootnoteDefinitionNode';
import { $createFootnoteNode } from '../node/FootnoteNode';
import { $createFootnoteSectionNode } from '../node/FootnoteSectionNode';
import { FootnotePlugin } from '../plugin';
import { IFootnoteService } from '../service';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const sectionIds = (editor: IEditor) =>
  (editor.getDocument('json') as any).root.children
    .find((child: any) => child.type === 'footnote-section')
    ?.children.map((child: any) => child.identifier);

describe('footnote sync in a mounted editor', () => {
  let editor: IEditor;
  let lexical: LexicalEditor;
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.append(root);
    editor = Editor.createEditor();
    editor.registerPlugins([MarkdownPlugin, CommonPlugin, FootnotePlugin]);
    lexical = editor.setRootElement(root);
  });

  afterEach(() => {
    editor.destroy();
    root.remove();
  });

  it('labels definitions, publishes a snapshot and reorders definitions by first reference', async () => {
    lexical.update(
      () => {
        $getRoot()
          .clear()
          .append(
            $createParagraphNode().append(
              $createTextNode('a'),
              $createFootnoteNode('y'),
              $createFootnoteNode('x'),
            ),
            $createFootnoteSectionNode().append(
              $createFootnoteDefinitionNode('x').append($createTextNode('Ex')),
              $createFootnoteDefinitionNode('unused'),
              $createFootnoteDefinitionNode('y').append($createTextNode('Why')),
            ),
          );
      },
      { discrete: true },
    );
    await flush();

    expect(sectionIds(editor)).toEqual(['y', 'x', 'unused']);
    const labels = Array.from(root.querySelectorAll('[data-footnote-label="true"]')).map(
      (label) => label.textContent,
    );
    expect(labels).toEqual(['1.', '2.', '']);
    expect(
      root
        .querySelector('[data-footnote-definition="unused"]')
        ?.getAttribute('data-footnote-orphan'),
    ).toBe('true');
    expect(editor.requireService(IFootnoteService)?.getSnapshot()).toEqual({
      definitions: { unused: '', x: 'Ex', y: 'Why' },
      numbers: { x: 2, y: 1 },
    });
  });

  it('recreates a missing definition when jumping to it', async () => {
    lexical.update(
      () => {
        $getRoot()
          .clear()
          .append($createParagraphNode().append($createFootnoteNode('gone')));
      },
      { discrete: true },
    );

    editor.dispatchCommand(FOOTNOTE_JUMP_TO_DEFINITION_COMMAND, 'gone');
    await flush();

    expect(sectionIds(editor)).toEqual(['gone']);
  });

  it('removes an empty unused definition on backspace but keeps referenced ones', async () => {
    lexical.update(
      () => {
        $getRoot()
          .clear()
          .append(
            $createParagraphNode().append($createFootnoteNode('kept')),
            $createFootnoteSectionNode().append(
              $createFootnoteDefinitionNode('kept'),
              $createFootnoteDefinitionNode('orphan'),
            ),
          );
      },
      { discrete: true },
    );

    lexical.update(
      () => {
        const section = $getRoot().getLastChild() as any;
        section.getLastChild().collapseAtStart();
        section.getFirstChild().collapseAtStart();
      },
      { discrete: true },
    );

    expect(sectionIds(editor)).toEqual(['kept']);
  });
});
