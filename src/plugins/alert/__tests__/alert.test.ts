import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  INSERT_PARAGRAPH_COMMAND,
  KEY_BACKSPACE_COMMAND,
} from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { INodePlugin } from '@/plugins/inode';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { INSERT_ALERT_COMMAND, UPDATE_ALERT_COMMAND } from '../command';
import { $createAlertNode, $isAlertNode } from '../node/AlertNode';
import { AlertPlugin } from '../plugin';

const getRootChildren = (editor: IEditor) => (editor.getDocument('json') as any).root.children;

describe('AlertPlugin', () => {
  let editor: IEditor;

  beforeEach(() => {
    editor = Editor.createEditor();
    editor.registerPlugins([INodePlugin, MarkdownPlugin, CommonPlugin, LitexmlPlugin, AlertPlugin]);
    editor.initNodeEditor();
  });

  it('reads GitHub alert syntax from Markdown', () => {
    editor.setDocument('markdown', '> [!WARNING]\n> Be **careful**\n>\n> Second paragraph');
    const [alert] = getRootChildren(editor);

    expect(alert).toMatchObject({ alertType: 'warning', type: 'alert' });
    expect(alert.children).toHaveLength(2);
    expect(alert.children[0].children).toEqual([
      expect.objectContaining({ text: 'Be ' }),
      expect.objectContaining({ format: 1, text: 'careful' }),
    ]);
    expect(alert.children[1].children[0].text).toBe('Second paragraph');
  });

  it('keeps plain blockquotes and unknown markers as quotes', () => {
    editor.setDocument('markdown', '> Just a quote\n\n> [!UNKNOWN]\n> text');
    const children = getRootChildren(editor);

    expect(children.map((child: any) => child.type)).toEqual(['quote', 'quote']);
  });

  it('accepts lowercase markers and alerts with an empty body', () => {
    editor.setDocument('markdown', '> [!tip]');
    const [alert] = getRootChildren(editor);

    expect(alert).toMatchObject({ alertType: 'tip', type: 'alert' });
    expect(alert.children).toEqual([expect.objectContaining({ type: 'paragraph' })]);
  });

  it('writes alerts back to GitHub Markdown and round-trips', () => {
    const markdown = '> [!CAUTION]\n> First line\n>\n> Second paragraph\n\nAfter\n';
    editor.setDocument('markdown', markdown);
    const output = editor.getDocument('markdown') as unknown as string;

    expect(output).toBe(markdown);
    editor.setDocument('markdown', output);
    expect(editor.getDocument('markdown')).toBe(markdown);
  });

  it('round-trips through LiteXML', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><alert type="important"><p>Read me</p></alert></root>',
    );
    const [alert] = getRootChildren(editor);
    expect(alert).toMatchObject({ alertType: 'important', type: 'alert' });

    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml).toMatch(/<alert id="[^"]+" type="important">/);
    expect(xml).toContain('Read me');

    editor.setDocument('litexml', xml);
    expect(getRootChildren(editor)[0]).toMatchObject({ alertType: 'important', type: 'alert' });
  });

  it('normalizes invalid LiteXML types and wraps inline children', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><alert type="bogus">Loose text</alert></root>',
    );
    const [alert] = getRootChildren(editor);

    expect(alert.alertType).toBe('note');
    expect(alert.children[0]).toMatchObject({ type: 'paragraph' });
    expect(alert.children[0].children[0].text).toBe('Loose text');
  });

  it('inserts an alert in place of an empty paragraph and updates its type', () => {
    const lexical = editor.getLexicalEditor()!;
    lexical.update(
      () => {
        const paragraph = $createParagraphNode();
        $getRoot().clear().append(paragraph);
        paragraph.select();
      },
      { discrete: true },
    );

    editor.dispatchCommand(INSERT_ALERT_COMMAND, { alertType: 'tip' });

    const key = lexical.read(() => {
      const children = $getRoot().getChildren();
      expect(children).toHaveLength(1);
      expect($isAlertNode(children[0])).toBe(true);
      return children[0].getKey();
    });
    expect(getRootChildren(editor)[0].alertType).toBe('tip');

    editor.dispatchCommand(UPDATE_ALERT_COMMAND, { alertType: 'caution', nodeKey: key });
    expect(getRootChildren(editor)[0].alertType).toBe('caution');
  });

  it('leaves the alert on Enter in an empty last paragraph', () => {
    const lexical = editor.getLexicalEditor()!;
    lexical.update(
      () => {
        const empty = $createParagraphNode();
        const alert = $createAlertNode('note').append(
          $createParagraphNode().append($createTextNode('Body')),
          empty,
        );
        $getRoot().clear().append(alert);
        empty.select();
      },
      { discrete: true },
    );

    editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
    const children = getRootChildren(editor);

    expect(children.map((child: any) => child.type)).toEqual(['alert', 'paragraph']);
    expect(children[0].children).toHaveLength(1);
  });

  it('unwraps the alert on Backspace at the start of its first block', () => {
    const lexical = editor.getLexicalEditor()!;
    lexical.update(
      () => {
        const text = $createTextNode('First');
        const alert = $createAlertNode('tip').append(
          $createParagraphNode().append(text),
          $createParagraphNode().append($createTextNode('Second')),
        );
        $getRoot().clear().append(alert);
        text.select(0, 0);
      },
      { discrete: true },
    );

    editor.dispatchCommand(
      KEY_BACKSPACE_COMMAND,
      new KeyboardEvent('keydown', { key: 'Backspace' }),
    );
    const children = getRootChildren(editor);

    expect(children.map((child: any) => child.type)).toEqual(['paragraph', 'paragraph']);
    expect(children[0].children[0].text).toBe('First');
  });
});
