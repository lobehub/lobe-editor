import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { INodePlugin } from '@/plugins/inode';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { INSERT_FOOTNOTE_COMMAND } from '../command';
import { $createFootnoteDefinitionNode } from '../node/FootnoteDefinitionNode';
import { $createFootnoteNode } from '../node/FootnoteNode';
import { $createFootnoteSectionNode } from '../node/FootnoteSectionNode';
import { FootnotePlugin } from '../plugin';
import { $normalizeFootnotes } from '../plugin/sync';
import { $collectFootnotes } from '../utils';

const getRootChildren = (editor: IEditor) => (editor.getDocument('json') as any).root.children;

const definitionIds = (section: any) => section.children.map((child: any) => child.identifier);

describe('FootnotePlugin', () => {
  let editor: IEditor;

  beforeEach(() => {
    editor = Editor.createEditor();
    editor.registerPlugins([
      INodePlugin,
      MarkdownPlugin,
      CommonPlugin,
      LitexmlPlugin,
      FootnotePlugin,
    ]);
    editor.initNodeEditor();
  });

  it('reads Markdown footnotes into references and one ordered section', () => {
    editor.setDocument('markdown', 'A[^b] B[^a] C[^b]\n\n[^a]: Ay **bold**\n\n[^b]: Bee\n\nAfter');
    const children = getRootChildren(editor);
    const section = children.at(-1);

    expect(children.map((child: any) => child.type)).toEqual([
      'paragraph',
      'paragraph',
      'footnote-section',
    ]);
    expect(children[0].children.filter((child: any) => child.type === 'footnote')).toEqual([
      expect.objectContaining({ identifier: 'b' }),
      expect.objectContaining({ identifier: 'a' }),
      expect.objectContaining({ identifier: 'b' }),
    ]);
    expect(definitionIds(section)).toEqual(['b', 'a']);
    expect(section.children[1].children).toEqual([
      expect.objectContaining({ text: 'Ay ' }),
      expect.objectContaining({ format: 1, text: 'bold' }),
    ]);
  });

  it('writes Markdown footnotes and round-trips', () => {
    const markdown = 'Text[^1] more[^note]\n\n[^1]: First\n\n[^note]: Second **bold**\n';
    editor.setDocument('markdown', markdown);
    const output = editor.getDocument('markdown') as unknown as string;

    expect(output).toContain('Text[^1] more[^note]');
    expect(output).toContain('[^1]: First');
    expect(output).toContain('[^note]: Second **bold**');

    editor.setDocument('markdown', output);
    expect(editor.getDocument('markdown')).toBe(output);
  });

  it('writes an empty definition for references whose definition was deleted', () => {
    editor.setDocument('markdown', 'A[^1] B[^2]\n\n[^1]: One\n\n[^2]: Two');
    editor.getLexicalEditor()!.update(
      () => {
        const section = $getRoot().getLastChild() as any;
        section.getLastChild().remove();
      },
      { discrete: true },
    );
    const output = editor.getDocument('markdown') as unknown as string;

    expect(output).toContain('[^1]: One');
    expect(output).toMatch(/\[\^2]:\s*$/m);
    editor.setDocument('markdown', output);
    expect(getRootChildren(editor)[0].children).toContainEqual(
      expect.objectContaining({ identifier: '2', type: 'footnote' }),
    );
  });

  it('round-trips through LiteXML', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><p>Claim<footnote ref="1"/></p><footnote-section><def ref="1">Source <b>bold</b></def></footnote-section></root>',
    );
    const children = getRootChildren(editor);
    expect(children[0].children[1]).toMatchObject({ identifier: '1', type: 'footnote' });
    expect(children[1].type).toBe('footnote-section');
    expect(children[1].children[0]).toMatchObject({ identifier: '1', type: 'footnote-definition' });

    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml).toMatch(/<footnote id="[^"]+" ref="1">/);
    expect(xml).toMatch(/<footnote-section id="[^"]+">/);
    expect(xml).toMatch(/<def id="[^"]+" ref="1">/);

    editor.setDocument('litexml', xml);
    expect(getRootChildren(editor)[1].children[0].children).toEqual([
      expect.objectContaining({ text: 'Source ' }),
      expect.objectContaining({ format: 1, text: 'bold' }),
    ]);
  });

  it('merges multiple LiteXML sections and unwraps paragraphs inside definitions', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><footnote-section><def ref="b"><p>B</p></def></footnote-section><p>x<footnote ref="a"/>y<footnote ref="b"/></p><footnote-section><def ref="a">A</def></footnote-section></root>',
    );
    const children = getRootChildren(editor);

    expect(children.map((child: any) => child.type)).toEqual(['paragraph', 'footnote-section']);
    expect(definitionIds(children[1])).toEqual(['a', 'b']);
    expect(children[1].children[1].children[0].text).toBe('B');
  });

  it('inserts a reference with an empty definition and creates the section', () => {
    const lexical = editor.getLexicalEditor()!;
    lexical.update(
      () => {
        const paragraph = $createParagraphNode().append($createTextNode('Hello'));
        $getRoot().clear().append(paragraph);
        paragraph.selectEnd();
      },
      { discrete: true },
    );

    editor.dispatchCommand(INSERT_FOOTNOTE_COMMAND, { focusDefinition: false });
    editor.dispatchCommand(INSERT_FOOTNOTE_COMMAND, undefined);

    const children = getRootChildren(editor);
    expect(children[0].children.filter((child: any) => child.type === 'footnote')).toEqual([
      expect.objectContaining({ identifier: '1' }),
      expect.objectContaining({ identifier: '2' }),
    ]);
    expect(children[1].type).toBe('footnote-section');
    expect(definitionIds(children[1])).toEqual(['1', '2']);
    expect(children[1].children[1].children).toEqual([]);

    const insertedInSection = lexical.read(() => {
      const selection = lexical.getEditorState()._selection as any;
      return selection?.anchor.getNode().getType();
    });
    expect(insertedInSection).toBe('footnote-definition');
  });

  it('numbers footnotes by first reference and normalizes definition order', () => {
    const lexical = editor.getLexicalEditor()!;
    lexical.update(
      () => {
        const paragraph = $createParagraphNode().append(
          $createFootnoteNode('z'),
          $createFootnoteNode('y'),
          $createFootnoteNode('z'),
        );
        const first = $createFootnoteSectionNode().append(
          $createFootnoteDefinitionNode('orphan'),
          $createFootnoteDefinitionNode('z'),
        );
        const second = $createFootnoteSectionNode().append($createFootnoteDefinitionNode('y'));
        $getRoot().clear().append(paragraph, first, second);
      },
      { discrete: true },
    );

    const numbers = lexical.read(() => Object.fromEntries($collectFootnotes().numbers));
    expect(numbers).toEqual({ y: 2, z: 1 });

    lexical.update($normalizeFootnotes, { discrete: true });
    const children = getRootChildren(editor);
    expect(children.map((child: any) => child.type)).toEqual(['paragraph', 'footnote-section']);
    expect(definitionIds(children[1])).toEqual(['z', 'y', 'orphan']);
  });
});
