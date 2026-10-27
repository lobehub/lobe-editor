import type { SerializedEditorState } from 'lexical';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LexicalRenderer } from '../LexicalRenderer';

const THUMBHASH = '1QcSHQRnh493V4dIh4eXh1h4kJUI';

function makeEditorState(children: any[]): SerializedEditorState {
  return {
    root: { children, direction: 'ltr', format: '', indent: 0, type: 'root', version: 1 },
  } as SerializedEditorState;
}

function paragraph(children: any[]) {
  return { children, direction: 'ltr', format: '', indent: 0, type: 'paragraph', version: 1 };
}

const toHTML = (children: any[]) =>
  renderToStaticMarkup(<LexicalRenderer value={makeEditorState(children)} />);

describe('LexicalRenderer media nodes', () => {
  it('renders a block image caption as figcaption', () => {
    const html = toHTML([
      {
        altText: 'sunset',
        caption: 'Sunset over the bay',
        maxWidth: 800,
        src: 'https://cdn/sunset.png',
        type: 'block-image',
        version: 1,
      },
    ]);

    expect(html).toContain('<figure');
    expect(html).toMatch(/<figcaption[^>]*>Sunset over the bay<\/figcaption>/);
  });

  it('migrates a legacy nested caption when rendering', () => {
    const html = toHTML([
      {
        altText: 'legacy',
        caption: {
          editorState: {
            root: { children: [paragraph([{ text: 'Old caption', type: 'text' }])], type: 'root' },
          },
        },
        maxWidth: 800,
        src: 'https://cdn/legacy.png',
        type: 'block-image',
        version: 1,
      },
    ]);

    expect(html).toMatch(/<figcaption[^>]*>Old caption<\/figcaption>/);
  });

  it('renders inline image caption as title', () => {
    const html = toHTML([
      paragraph([
        {
          altText: 'icon',
          caption: 'Inline caption',
          maxWidth: 64,
          src: 'https://cdn/icon.png',
          type: 'image',
          version: 1,
        },
      ]),
    ]);

    expect(html).toContain('title="Inline caption"');
    expect(html).not.toContain('<figcaption');
  });

  it('wraps images with a placeholder frame when thumbhash or accent is set', () => {
    const html = toHTML([
      {
        accent: '#336699',
        altText: 'a',
        maxWidth: 800,
        src: 'https://cdn/a.png',
        thumbhash: THUMBHASH,
        type: 'block-image',
        version: 1,
      },
    ]);

    expect(html).toContain('src="https://cdn/a.png"');
    expect(html).toContain('transition:opacity 0.3s ease-out');
  });

  it('renders file nodes with type icon, preview and download actions', () => {
    const html = toHTML([
      paragraph([
        {
          ext: 'pdf',
          fileUrl: 'https://cdn/report.pdf',
          mimeType: 'application/pdf',
          name: 'report.pdf',
          size: 100,
          status: 'uploaded',
          type: 'file',
          version: 1,
        },
      ]),
    ]);

    expect(html).toContain('data-file-status="uploaded"');
    expect(html).toContain('data-file-action="preview"');
    expect(html).toContain('target="_blank"');
    expect(html).toMatch(/data-file-action="download"[^>]*download="report.pdf"/);
    expect(html).toContain('href="https://cdn/report.pdf"');
  });

  it('does not render actions for pending files', () => {
    const html = toHTML([
      paragraph([{ name: 'draft.txt', status: 'pending', type: 'file', version: 1 }]),
    ]);

    expect(html).toContain('data-file-status="pending"');
    expect(html).not.toContain('data-file-action');
  });
});
