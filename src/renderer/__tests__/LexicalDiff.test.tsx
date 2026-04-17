import { DecoratorNode, type LexicalUpdateJSON, type SerializedEditorState } from 'lexical';
import { Children } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LexicalDiff } from '../LexicalDiff';
import { computeLexicalDiffRows } from '../diff/compute';
import type { HeadlessRenderContext, HeadlessRenderableNode } from '../types';

function makeEditorState(children: any[]): SerializedEditorState {
  return {
    root: {
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as SerializedEditorState;
}

function makeText(text: string, extra: Record<string, unknown> = {}) {
  return {
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    text,
    type: 'text',
    version: 1,
    ...extra,
  };
}

function makeParagraph(text: string) {
  return {
    children: [makeText(text)],
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    type: 'paragraph',
    version: 1,
  };
}

function makeHeading(text: string, tag: 'h1' | 'h2' | 'h3' = 'h1') {
  return {
    children: [makeText(text)],
    direction: 'ltr',
    format: '',
    indent: 0,
    tag,
    type: 'heading',
    version: 1,
  };
}

function makeDiffNode(
  diffType:
    | 'add'
    | 'remove'
    | 'modify'
    | 'unchanged'
    | 'listItemModify'
    | 'listItemRemove'
    | 'listItemAdd',
  children: any[],
) {
  return {
    children,
    diffType,
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'diff',
    version: 1,
  };
}

function makeList(items: string[], listType: 'bullet' | 'number' = 'bullet') {
  return {
    children: items.map((item, index) => ({
      checked: undefined,
      children: [makeParagraph(item)],
      direction: null,
      format: '',
      indent: 0,
      type: 'listitem',
      value: index + 1,
      version: 1,
    })),
    direction: 'ltr',
    format: '',
    indent: 0,
    listType,
    start: 1,
    tag: listType === 'number' ? 'ol' : 'ul',
    type: 'list',
    version: 1,
  };
}

type SerializedHeadlessTestNode = {
  label: string;
  type: 'headless-test';
  version: 1;
};

class HeadlessTestNode extends DecoratorNode<null> implements HeadlessRenderableNode {
  __label: string;

  static getType(): string {
    return 'headless-test';
  }

  static clone(node: HeadlessTestNode): HeadlessTestNode {
    return new HeadlessTestNode(node.__label, node.__key);
  }

  static importJSON(serializedNode: SerializedHeadlessTestNode): HeadlessTestNode {
    return new HeadlessTestNode(serializedNode.label).updateFromJSON(serializedNode);
  }

  static importDOM(): null {
    return null;
  }

  constructor(label: string, key?: string) {
    super(key);
    this.__label = label;
  }

  createDOM(): HTMLElement {
    return document.createElement('span');
  }

  updateDOM(): false {
    return false;
  }

  decorate(): null {
    return null;
  }

  exportJSON(): SerializedHeadlessTestNode {
    return {
      ...super.exportJSON(),
      label: this.__label,
      type: 'headless-test',
      version: 1,
    };
  }

  renderHeadless({ extra, key }: HeadlessRenderContext) {
    return (
      <span data-suffix={(extra?.suffix as string) || ''} key={key}>
        {this.__label}
      </span>
    );
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<any>): this {
    this.__label = serializedNode.label;
    return super.updateFromJSON(serializedNode);
  }
}

describe('computeLexicalDiffRows', () => {
  it('returns equal rows for identical documents', () => {
    const value = makeEditorState([makeParagraph('Hello')]);
    const rows = computeLexicalDiffRows(value, value);

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('equal');
    expect(rows[0].oldCell?.blockType).toBe('paragraph');
    expect(rows[0].newCell?.blockType).toBe('paragraph');
  });

  it('splits inline text modifications and preserves marks in a modify row', () => {
    const oldValue = makeEditorState([makeParagraph('hello world')]);
    const newValue = makeEditorState([makeParagraph('hello there')]);

    const rows = computeLexicalDiffRows(oldValue, newValue);

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('modify');

    const oldTextNodes = (rows[0].oldCell?.block as any).children as any[];
    const newTextNodes = (rows[0].newCell?.block as any).children as any[];

    expect(oldTextNodes.map((node) => node.text).join('')).toBe('hello world');
    expect(newTextNodes.map((node) => node.text).join('')).toBe('hello there');
    expect(
      oldTextNodes.some(
        (node) => typeof node.style === 'string' && node.style.includes('line-through'),
      ),
    ).toBe(true);
    expect(
      newTextNodes.some(
        (node) => typeof node.style === 'string' && node.style.includes('--ant-color-success'),
      ),
    ).toBe(true);
  });

  it('creates insert and delete rows for unmatched blocks', () => {
    const oldValue = makeEditorState([makeParagraph('A')]);
    const newValue = makeEditorState([makeParagraph('A'), makeParagraph('B')]);

    const rows = computeLexicalDiffRows(oldValue, newValue);

    expect(rows.map((row) => row.kind)).toEqual(['equal', 'insert']);
    expect(rows[1].oldCell).toBeNull();
    expect(rows[1].newCell?.blockType).toBe('paragraph');
  });

  it('pairs delete and insert groups into modify rows for cross-type changes', () => {
    const oldValue = makeEditorState([makeParagraph('Alpha')]);
    const newValue = makeEditorState([makeHeading('Alpha')]);

    const rows = computeLexicalDiffRows(oldValue, newValue);

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('modify');
    expect(rows[0].oldCell?.blockType).toBe('paragraph');
    expect(rows[0].newCell?.blockType).toBe('heading:h1');
  });

  it('keeps block nodes renderable without custom diff renderers', () => {
    const rows = computeLexicalDiffRows(
      makeEditorState([makeList(['A', 'B'])]),
      makeEditorState([makeList(['A', 'C'])]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('modify');
    expect(rows[0].oldCell?.blockType).toBe('list:bullet');
  });

  it('does not mutate input states', () => {
    const oldValue = makeEditorState([makeParagraph('hello world')]);
    const newValue = makeEditorState([makeParagraph('hello there')]);
    const oldSnapshot = JSON.stringify(oldValue);
    const newSnapshot = JSON.stringify(newValue);

    computeLexicalDiffRows(oldValue, newValue);

    expect(JSON.stringify(oldValue)).toBe(oldSnapshot);
    expect(JSON.stringify(newValue)).toBe(newSnapshot);
  });
});

describe('LexicalDiff', () => {
  it('renders default header labels and diff content', () => {
    const html = renderToStaticMarkup(
      <LexicalDiff
        newValue={makeEditorState([makeParagraph('New paragraph')])}
        oldValue={makeEditorState([makeParagraph('Old paragraph')])}
      />,
    );

    expect(html).toContain('Old');
    expect(html).toContain('New');
    expect(html).toContain('paragraph');
    expect(html).toContain('line-through');
    expect(html).toContain('--ant-color-success');
  });

  it('supports custom labels and fallback block renderer', () => {
    const html = renderToStaticMarkup(
      <LexicalDiff
        labels={{ new: 'After', old: 'Before' }}
        newValue={makeEditorState([makeHeading('New title')])}
        oldValue={makeEditorState([makeParagraph('Old title')])}
        renderBlockDiff={({ blockType, row }) => {
          if (blockType) return null;
          return {
            new: <div data-kind={row.kind}>fallback new</div>,
            old: <div data-kind={row.kind}>fallback old</div>,
          };
        }}
      />,
    );

    expect(html).toContain('Before');
    expect(html).toContain('After');
    expect(html).toContain('fallback old');
    expect(html).toContain('fallback new');
  });

  it('prefers normalized block renderers over base-type renderers', () => {
    const html = renderToStaticMarkup(
      <LexicalDiff
        blockRenderers={{
          'heading': () => ({ new: <div>base new</div>, old: <div>base old</div> }),
          'heading:h1': () => ({ new: <div>typed new</div>, old: <div>typed old</div> }),
        }}
        newValue={makeEditorState([makeHeading('New heading')])}
        oldValue={makeEditorState([makeHeading('Old heading')])}
      />,
    );

    expect(html).toContain('typed old');
    expect(html).toContain('typed new');
    expect(html).not.toContain('base old');
  });

  it('falls back to the default renderer when custom renderers return null or only one side', () => {
    const html = renderToStaticMarkup(
      <LexicalDiff
        blockRenderers={{
          paragraph: () => ({ old: <div>custom old</div> }),
        }}
        newValue={makeEditorState([makeParagraph('render new')])}
        oldValue={makeEditorState([makeParagraph('render old')])}
        renderBlockDiff={() => null}
      />,
    );

    expect(html).toContain('custom old');
    expect(html).toContain('render');
    expect(html).toContain('--ant-color-success');
  });

  it('passes extraNodes, renderContext, variant, and overrides to the inner LexicalRenderer', () => {
    const customState = makeEditorState([
      { label: 'custom block', type: 'headless-test', version: 1 },
    ]);

    const customHtml = renderToStaticMarkup(
      <LexicalDiff
        extraNodes={[HeadlessTestNode]}
        newValue={customState}
        oldValue={customState}
        renderContext={{ extra: { suffix: '!' } }}
        variant="chat"
      />,
    );

    expect(customHtml).toContain('custom block');
    expect(customHtml).toContain('data-suffix="!"');
    expect(customHtml).toContain('--common-font-size:14px');

    const overrideHtml = renderToStaticMarkup(
      <LexicalDiff
        newValue={makeEditorState([makeParagraph('override new')])}
        oldValue={makeEditorState([makeParagraph('override old')])}
        overrides={{
          paragraph: (_node, key, children) => (
            <section data-key={key}>{Children.toArray(children)}</section>
          ),
        }}
      />,
    );

    expect(overrideHtml).toContain('<section');
    expect(overrideHtml).toContain('override');
    expect(overrideHtml).toContain('--ant-color-success');
  });

  it('renders serialized diff nodes through the inner LexicalRenderer', () => {
    const diffState = makeEditorState([
      makeDiffNode('modify', [makeParagraph('Old block'), makeParagraph('New block')]),
      makeDiffNode('add', [makeParagraph('Added block')]),
      makeDiffNode('remove', [makeParagraph('Removed block')]),
    ]);

    const html = renderToStaticMarkup(<LexicalDiff newValue={diffState} oldValue={diffState} />);

    expect(html).toContain('data-diff-type="modify"');
    expect(html).toContain('data-diff-type="add"');
    expect(html).toContain('data-diff-type="remove"');
    expect(html).toContain('Old block');
    expect(html).toContain('New block');
    expect(html).toContain('Added block');
    expect(html).toContain('Removed block');
  });
});
