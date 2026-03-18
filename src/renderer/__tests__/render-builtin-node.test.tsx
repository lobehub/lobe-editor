import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { renderBuiltinNode } from '../engine/render-builtin-node';

function toHTML(
  node: Record<string, any>,
  children: ReactNode[] | null = null,
  textContent?: string,
) {
  const slugs = new Map<string, number>();
  const el = renderBuiltinNode(node, 'k', children, slugs, textContent);
  return renderToStaticMarkup(<div>{el}</div>)
    .replace(/^<div>/, '')
    .replace(/<\/div>$/, '');
}

describe('renderBuiltinNode', () => {
  it('renders paragraph', () => {
    expect(toHTML({ type: 'paragraph' }, ['hello'])).toBe('<p>hello</p>');
  });

  it('renders paragraph with textAlign', () => {
    const html = toHTML({ format: 'center', type: 'paragraph' }, ['text']);
    expect(html).toContain('text-align:center');
  });

  it('renders heading with slug', () => {
    const html = toHTML({ tag: 'h2', type: 'heading' }, ['Title'], 'Title');
    expect(html).toContain('<h2');
    expect(html).toContain('id="title"');
  });

  it('renders quote with editor_quote class', () => {
    const html = toHTML({ type: 'quote' }, ['quoted']);
    expect(html).toContain('class="editor_quote"');
    expect(html).toContain('quoted');
  });

  it('renders ordered list with class', () => {
    const html = toHTML({ listType: 'number', start: 1, type: 'list' }, ['item']);
    expect(html).toContain('editor_listOrdered');
    expect(html).toContain('<ol');
  });

  it('renders unordered list with class', () => {
    const html = toHTML({ listType: 'bullet', start: 1, type: 'list' }, ['item']);
    expect(html).toContain('editor_listUnordered');
    expect(html).toContain('<ul');
  });

  it('renders listitem with checkbox class', () => {
    const html = toHTML({ checked: true, type: 'listitem' }, ['done']);
    expect(html).toContain('editor_listItemChecked');
    expect(html).toContain('done');
  });

  it('renders link', () => {
    const html = toHTML({ type: 'link', url: 'https://example.com' }, ['link text']);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('link text');
  });

  it('renders table with classes', () => {
    const html = toHTML({ type: 'table' }, ['row']);
    expect(html).toContain('editor_table');
    expect(html).toContain('<tbody>');
  });

  it('renders tablecell as th with class', () => {
    const html = toHTML({ headerState: 1, type: 'tablecell' }, ['Header']);
    expect(html).toContain('<th');
    expect(html).toContain('editor_table_cell_header');
  });

  it('renders tablecell as td with class', () => {
    const html = toHTML({ headerState: 0, type: 'tablecell' }, ['Cell']);
    expect(html).toContain('<td');
    expect(html).toContain('editor_table_cell');
  });

  it('renders linebreak', () => {
    expect(toHTML({ type: 'linebreak' })).toBe('<br/>');
  });

  it('renders cursor as null', () => {
    const slugs = new Map<string, number>();
    expect(renderBuiltinNode({ type: 'cursor' }, 'k', null, slugs)).toBeNull();
  });

  it('renders codeInline with class', () => {
    const html = toHTML({ type: 'codeInline' }, ['inline code']);
    expect(html).toContain('editor_code');
    expect(html).toContain('inline code');
  });
});
