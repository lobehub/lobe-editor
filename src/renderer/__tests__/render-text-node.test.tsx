import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { renderTextNode } from '../engine/render-text-node';

function toHTML(node: Record<string, any>, key = 'k') {
  const el = renderTextNode(node, key);
  return renderToStaticMarkup(<div>{el}</div>)
    .replace(/^<div>/, '')
    .replace(/<\/div>$/, '');
}

describe('renderTextNode', () => {
  it('renders plain text', () => {
    expect(toHTML({ format: 0, text: 'hello' })).toBe('hello');
  });

  it('preserves whitespace for multiline text', () => {
    const html = toHTML({ format: 0, text: 'line 1\n\n  line 2' });
    expect(html).toContain('white-space:break-spaces');
    expect(html).toContain('line 1');
    expect(html).toContain('  line 2');
  });

  it('renders bold', () => {
    expect(toHTML({ format: 1, text: 'bold' })).toBe('<strong>bold</strong>');
  });

  it('renders italic', () => {
    expect(toHTML({ format: 2, text: 'italic' })).toBe('<em>italic</em>');
  });

  it('renders strikethrough', () => {
    expect(toHTML({ format: 4, text: 'del' })).toBe('<s>del</s>');
  });

  it('renders underline', () => {
    expect(toHTML({ format: 8, text: 'uline' })).toBe('<u>uline</u>');
  });

  it('renders inline code', () => {
    expect(toHTML({ format: 16, text: 'code' })).toBe('<code>code</code>');
  });

  it('renders subscript', () => {
    expect(toHTML({ format: 32, text: 'sub' })).toBe('<sub>sub</sub>');
  });

  it('renders superscript', () => {
    expect(toHTML({ format: 64, text: 'sup' })).toBe('<sup>sup</sup>');
  });

  it('renders highlight', () => {
    expect(toHTML({ format: 128, text: 'hi' })).toBe('<mark>hi</mark>');
  });

  it('combines bold + italic', () => {
    expect(toHTML({ format: 3, text: 'bi' })).toBe('<em><strong>bi</strong></em>');
  });

  it('applies inline style', () => {
    const html = toHTML({ format: 0, style: 'color: red', text: 'colored' });
    expect(html).toContain('style');
    expect(html).toContain('colored');
  });

  it('combines format + style', () => {
    const html = toHTML({ format: 1, style: 'color: blue', text: 'x' });
    expect(html).toContain('<strong>');
    expect(html).toContain('color');
  });
});
