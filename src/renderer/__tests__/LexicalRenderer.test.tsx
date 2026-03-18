import { DecoratorNode, type LexicalUpdateJSON, type SerializedEditorState } from 'lexical';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LexicalRenderer } from '../LexicalRenderer';
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

function toHTML(value: SerializedEditorState, props: Record<string, any> = {}) {
  return renderToStaticMarkup(<LexicalRenderer value={value} {...props} />);
}

type SerializedHeadlessTestNode = {
  label: string;
  type: 'headless-test';
  version: 1;
};

class HeadlessTestNode extends DecoratorNode<any> implements HeadlessRenderableNode {
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

  exportJSON(): SerializedHeadlessTestNode {
    return {
      ...super.exportJSON(),
      label: this.__label,
      type: 'headless-test',
      version: 1,
    };
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<any>): this {
    this.__label = serializedNode.label;
    return super.updateFromJSON(serializedNode);
  }

  decorate(): null {
    return null;
  }

  renderHeadless({ extra, key }: HeadlessRenderContext) {
    return (
      <span data-suffix={(extra?.suffix as string) || ''} key={key}>
        {this.__label}
      </span>
    );
  }
}

describe('LexicalRenderer', () => {
  it('renders a simple paragraph', () => {
    const value = makeEditorState([
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Hello',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      },
    ]);

    const html = toHTML(value);
    expect(html).toContain('<p>Hello</p>');
  });

  it('renders heading with slug', () => {
    const value = makeEditorState([
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'My Title',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        tag: 'h1',
        type: 'heading',
        version: 1,
      },
    ]);

    const html = toHTML(value);
    expect(html).toContain('<h1');
    expect(html).toContain('id="my-title"');
  });

  it('renders bold text', () => {
    const value = makeEditorState([
      {
        children: [
          {
            detail: 0,
            format: 1,
            mode: 'normal',
            style: '',
            text: 'bold',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      },
    ]);

    const html = toHTML(value);
    expect(html).toContain('<strong>bold</strong>');
  });

  it('renders math node via registry', () => {
    const value = makeEditorState([{ code: 'E=mc^2', type: 'math', version: 1 }]);

    const html = toHTML(value);
    expect(html).toContain('katex');
  });

  it('renders code block', () => {
    const value = makeEditorState([
      {
        code: 'const x = 1;',
        codeTheme: '',
        language: 'javascript',
        options: { indentWithTabs: false, lineNumbers: false, tabSize: 2 },
        type: 'code',
        version: 1,
      },
    ]);

    const html = toHTML(value);
    expect(html).toContain('<pre');
    expect(html).toContain('JavaScript');
    expect(html).toContain('const x = 1;');
  });

  it('renders horizontal rule', () => {
    const value = makeEditorState([{ type: 'horizontalrule', version: 1 }]);
    const html = toHTML(value);
    expect(html).toContain('<hr');
  });

  it('renders image', () => {
    const value = makeEditorState([
      {
        altText: 'test image',
        height: 200,
        maxWidth: 800,
        src: 'https://example.com/img.png',
        type: 'image',
        version: 1,
        width: 400,
      },
    ]);

    const html = toHTML(value);
    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.com/img.png"');
    expect(html).toContain('alt="test image"');
  });

  it('renders mention with class', () => {
    const value = makeEditorState([{ label: 'Alice', type: 'mention', version: 1 }]);

    const html = toHTML(value);
    expect(html).toContain('editor_mention');
    expect(html).toContain('@Alice');
  });

  it('supports overrides', () => {
    const value = makeEditorState([
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'text',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      },
    ]);

    const html = renderToStaticMarkup(
      <LexicalRenderer
        overrides={{
          paragraph: (_node, key, children) => (
            <div className="custom-p" key={key}>
              {children}
            </div>
          ),
        }}
        value={value}
      />,
    );
    expect(html).toContain('class="custom-p"');
    expect(html).not.toContain('<p>');
  });

  it('renders nodes through headless render interface', () => {
    const value = makeEditorState([{ label: 'custom', type: 'headless-test', version: 1 }]);

    const html = toHTML(value, {
      extraNodes: [HeadlessTestNode],
      renderContext: { extra: { suffix: 'ctx' } },
    });

    expect(html).toContain('>custom</span>');
    expect(html).toContain('data-suffix="ctx"');
  });

  it('renders with custom tag', () => {
    const value = makeEditorState([
      {
        children: [
          { detail: 0, format: 0, mode: 'normal', style: '', text: 'x', type: 'text', version: 1 },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      },
    ]);

    const html = toHTML(value, { as: 'article' });
    expect(html).toContain('<article');
  });

  it('renders list with classes', () => {
    const value = makeEditorState([
      {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'item 1',
                type: 'text',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            value: 1,
            version: 1,
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'item 2',
                type: 'text',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            value: 2,
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        listType: 'bullet',
        start: 1,
        tag: 'ul',
        type: 'list',
        version: 1,
      },
    ]);

    const html = toHTML(value);
    expect(html).toContain('editor_listUnordered');
    expect(html).toContain('editor_listItem');
    expect(html).toContain('item 1');
    expect(html).toContain('item 2');
  });

  it('applies variant CSS variables', () => {
    const value = makeEditorState([
      {
        children: [
          { detail: 0, format: 0, mode: 'normal', style: '', text: 'hi', type: 'text', version: 1 },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      },
    ]);

    const html = toHTML(value, { variant: 'chat' });
    expect(html).toContain('--common-font-size:14px');
    expect(html).toContain('--common-header-multiple:0.25');
  });
});
