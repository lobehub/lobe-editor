import type { SerializedEditorState } from 'lexical';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LexicalRenderer } from '@/renderer/LexicalRenderer';

const paragraph = (children: any[]) => ({
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
});

const text = (value: string) => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text: value,
  type: 'text',
  version: 1,
});

const reference = (identifier: string) => ({ identifier, type: 'footnote', version: 1 });

const definition = (identifier: string, value: string) => ({
  children: [text(value)],
  direction: 'ltr',
  format: '',
  identifier,
  indent: 0,
  type: 'footnote-definition',
  version: 1,
});

const state = (children: any[]) =>
  ({
    root: { children, direction: 'ltr', format: '', indent: 0, type: 'root', version: 1 },
  }) as SerializedEditorState;

describe('footnote and alert rendering', () => {
  it('renders numbered references, sorted definitions and back links', () => {
    const html = renderToStaticMarkup(
      <LexicalRenderer
        value={state([
          paragraph([text('A'), reference('b'), text('B'), reference('a'), reference('missing')]),
          {
            children: [
              definition('a', 'Alpha'),
              definition('orphan', 'Unused'),
              definition('b', 'Beta'),
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'footnote-section',
            version: 1,
          },
        ])}
      />,
    );

    expect(html).toContain('href="#fn-b"');
    expect(html).toMatch(/title="Beta"[^>]*>\[1]</);
    expect(html).toMatch(/title="Alpha"[^>]*>\[2]</);
    expect(html).toMatch(
      /data-footnote-missing="true"[^>]*title="Missing footnote definition"[^>]*>\[3]</,
    );
    expect(html.indexOf('id="fn-b"')).toBeLessThan(html.indexOf('id="fn-a"'));
    expect(html).toContain('href="#fnref-a"');
    expect(html).not.toContain('Unused');
  });

  it('renders alerts with their type label', () => {
    const html = renderToStaticMarkup(
      <LexicalRenderer
        value={state([
          {
            alertType: 'warning',
            children: [paragraph([text('Careful')])],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'alert',
            version: 1,
          },
        ])}
      />,
    );

    expect(html).toContain('data-alert-type="warning"');
    expect(html).toContain('Warning');
    expect(html).toContain('Careful');
  });
});
