// @vitest-environment node
import { createHeadlessEditor } from '@lobehub/editor/headless';
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';
import { IS_BOLD } from 'lexical';
import { describe, expect, it } from 'vitest';

type SerializedNode = SerializedLexicalNode & {
  children?: SerializedNode[];
  format?: number | string;
  tag?: string;
  text?: string;
};

const text = (value: string, format = 0) => ({
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text: value,
  type: 'text',
  version: 1,
});

const paragraphState = (...children: ReturnType<typeof text>[]) =>
  ({
    root: {
      children: [
        { children, direction: 'ltr', format: '', indent: 0, type: 'paragraph', version: 1 },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }) as unknown as SerializedEditorState<SerializedLexicalNode>;

const fromMarkdown = (markdown: string) => {
  const editor = createHeadlessEditor();
  try {
    editor.hydrateMarkdown(markdown);
    const { editorData, markdown: exported } = editor.export();
    return { editorData: editorData as unknown as { root: SerializedNode }, markdown: exported };
  } finally {
    editor.destroy();
  }
};

const fromEditorData = (state: SerializedEditorState<SerializedLexicalNode>) => {
  const editor = createHeadlessEditor();
  try {
    editor.hydrateEditorData(state);
    return editor.export().markdown;
  } finally {
    editor.destroy();
  }
};

const leaves = (node: SerializedNode): SerializedNode[] =>
  node.children ? node.children.flatMap(leaves) : [node];

const plainText = (node: SerializedNode) =>
  leaves(node)
    .map((leaf) => leaf.text ?? '')
    .join('');

const boldTexts = (node: SerializedNode) =>
  leaves(node)
    .filter((leaf) => typeof leaf.format === 'number' && (leaf.format & IS_BOLD) !== 0)
    .map((leaf) => leaf.text);

/** Export → import → export must reach a fixed point after the first export. */
const expectStableRoundTrip = (markdown: string) => {
  const first = fromMarkdown(markdown);
  const second = fromMarkdown(first.markdown);
  const third = fromMarkdown(second.markdown);

  expect(second.markdown).toBe(first.markdown);
  expect(third.markdown).toBe(first.markdown);
  expect(plainText(second.editorData.root)).toBe(plainText(first.editorData.root));
  expect(boldTexts(second.editorData.root)).toEqual(boldTexts(first.editorData.root));

  return first;
};

describe('markdown export round trip', () => {
  it('keeps a bold literal asterisk bold instead of flattening it to five asterisks', () => {
    const first = expectStableRoundTrip('| code | line |\n| --- | --- |\n| **\\*** | Provozní |\n');

    expect(boldTexts(first.editorData.root)).toEqual(['*']);
    expect(first.markdown).not.toContain('\\*\\*\\*\\*\\*');
  });

  it('escapes literal markdown characters held in text nodes', () => {
    const literal =
      'a\\*b, P&L, 背景事件：__（影响已消化）"一行；其余：__（未知）, <model>, [x](y), `tick`';
    const markdown = fromEditorData(paragraphState(text(literal)));
    const reimported = fromMarkdown(markdown);

    expect(plainText(reimported.editorData.root)).toBe(literal);
    expect(boldTexts(reimported.editorData.root)).toEqual([]);
  });

  it('does not turn literal block markers at the start of a paragraph into blocks', () => {
    for (const literal of ['# not a heading', '> not a quote', '- not a list', '1. not a list']) {
      const markdown = fromEditorData(paragraphState(text(literal)));
      const reimported = fromMarkdown(markdown);

      expect(reimported.editorData.root.children?.[0]?.type).toBe('paragraph');
      expect(plainText(reimported.editorData.root)).toBe(literal);
    }
  });

  it('keeps plain-text URLs intact', () => {
    const literal = 'see https://example.com/a_b_c?x=1&y=*2* now';
    const markdown = fromEditorData(paragraphState(text(literal)));

    expect(plainText(fromMarkdown(markdown).editorData.root)).toBe(literal);
  });

  it('does not grow the space after a bold label on every round trip', () => {
    const single = expectStableRoundTrip('**Mission:** Eric order');
    const double = expectStableRoundTrip('**Mission:**  Eric order');

    expect(single.markdown).toBe('**Mission:** Eric order\n');
    expect(double.markdown).toBe('**Mission:**  Eric order\n');
  });

  it('still separates a bold label ending in punctuation from the word after it', () => {
    const markdown = fromEditorData(paragraphState(text('Mission:', IS_BOLD), text('Eric')));

    expect(boldTexts(fromMarkdown(markdown).editorData.root)).toEqual(['Mission:']);
  });

  it('leaves code content untouched', () => {
    const code = '```js\nres.json({ data: rows }); a*b_c \\n <x>\n```\n\nUse `a*b_c<x>` inline.';
    const first = expectStableRoundTrip(code);

    expect(first.markdown).toContain('res.json({ data: rows }); a*b_c \\n <x>');
    expect(first.markdown).toContain('`a*b_c<x>`');
  });
});
