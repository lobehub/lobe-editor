// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { $getRoot } from 'lexical';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';

import { GET_MENTIONS_COMMAND, INSERT_MENTION_COMMAND, MentionPlugin } from '../../';

const documentWithMentions = (mentions: Array<{ id: string; label: string }>) => ({
  root: {
    children: [
      {
        children: mentions.map(({ id, label }) => ({
          label,
          metadata: { id },
          type: 'mention',
          version: 1,
        })),
        direction: null,
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
});

const nestedDocument = {
  root: {
    children: [
      {
        children: [
          {
            children: [
              {
                children: [
                  { label: 'Nested Alice', metadata: { id: 'alice' }, type: 'mention', version: 1 },
                ],
                type: 'paragraph',
                version: 1,
              },
            ],
            type: 'quote',
            version: 1,
          },
        ],
        type: 'paragraph',
        version: 1,
      },
      {
        children: [{ label: 'Bob', metadata: { id: 'bob' }, type: 'mention', version: 1 }],
        type: 'paragraph',
        version: 1,
      },
    ],
    type: 'root',
  },
};

const createMentionEditor = () => {
  const editor = Editor.createEditor().registerPlugins([
    CommonPlugin,
    MarkdownPlugin,
    MentionPlugin,
  ]);
  editor.initNodeEditor();
  return editor;
};

const getMentions = (editor: ReturnType<typeof createMentionEditor>) => {
  let result: Array<{ label: string; metadata: Record<string, unknown> }> | undefined;
  editor.dispatchCommand(GET_MENTIONS_COMMAND, {
    onResult: (mentions) => {
      result = mentions;
    },
  });
  return result;
};

describe('mention commands', () => {
  it('returns every current mention in document order, including duplicates', () => {
    const editor = createMentionEditor();
    editor.setDocument(
      'json',
      documentWithMentions([
        { id: 'alice', label: 'Alice' },
        { id: 'bob', label: 'Bob' },
        { id: 'alice', label: 'Alice again' },
      ]),
    );

    expect(getMentions(editor)).toEqual([
      { label: 'Alice', metadata: { id: 'alice' } },
      { label: 'Bob', metadata: { id: 'bob' } },
      { label: 'Alice again', metadata: { id: 'alice' } },
    ]);
    editor.destroy();
  });

  it('reflects the current document after a mention is removed', () => {
    const editor = createMentionEditor();
    editor.setDocument(
      'json',
      documentWithMentions([
        { id: 'alice', label: 'Alice' },
        { id: 'bob', label: 'Bob' },
      ]),
    );
    editor.setDocument('json', documentWithMentions([{ id: 'bob', label: 'Bob' }]));

    expect(getMentions(editor)).toEqual([{ label: 'Bob', metadata: { id: 'bob' } }]);
    editor.destroy();
  });

  it('emits mentionInserted only for a successful insertion command', () => {
    const editor = createMentionEditor();
    const inserted: Array<{ label: string; metadata: Record<string, unknown> }> = [];
    let queriedDuringEvent: Array<{ label: string; metadata: Record<string, unknown> }> | undefined;
    editor.on('mentionInserted', (mention) => inserted.push(mention));
    editor.setDocument('json', documentWithMentions([]));
    expect(inserted).toEqual([]);
    editor.on('mentionInserted', () => {
      editor.dispatchCommand(GET_MENTIONS_COMMAND, {
        onResult: (mentions) => {
          queriedDuringEvent = mentions;
        },
      });
    });

    editor.getLexicalEditor()!.update(() => {
      $getRoot().selectEnd();
      editor.dispatchCommand(INSERT_MENTION_COMMAND, {
        label: 'Alice',
        metadata: { id: 'alice' },
      });
    });

    expect(inserted).toEqual([{ label: 'Alice', metadata: { id: 'alice' } }]);
    expect(queriedDuringEvent).toEqual([{ label: 'Alice', metadata: { id: 'alice' } }]);
    editor.destroy();
  });

  it('keeps nested document traversal and editor instances isolated', () => {
    const first = createMentionEditor();
    const second = createMentionEditor();
    first.setDocument('json', nestedDocument);
    second.setDocument('json', documentWithMentions([{ id: 'carol', label: 'Carol' }]));

    expect(getMentions(first)).toEqual([
      { label: 'Nested Alice', metadata: { id: 'alice' } },
      { label: 'Bob', metadata: { id: 'bob' } },
    ]);
    expect(getMentions(second)).toEqual([{ label: 'Carol', metadata: { id: 'carol' } }]);
    first.destroy();
    second.destroy();
  });
});
