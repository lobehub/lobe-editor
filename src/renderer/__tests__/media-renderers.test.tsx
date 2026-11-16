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

  it('renders a percent display width on block images', () => {
    const html = toHTML([
      {
        altText: 'wide',
        displayWidth: 75,
        maxWidth: 800,
        src: 'https://cdn/wide.png',
        type: 'block-image',
        version: 1,
        width: 0,
      },
    ]);

    expect(html).toMatch(/style="[^"]*width:75%/);
    expect(html).not.toContain('max-width:min(800px');
  });

  it('puts a percent width on the placeholder frame, not the image', () => {
    const html = toHTML([
      {
        altText: 'wide',
        displayWidth: 75,
        maxWidth: 800,
        src: 'https://cdn/wide.png',
        thumbhash: THUMBHASH,
        type: 'block-image',
        version: 1,
      },
    ]);

    expect(html).toMatch(/<span[^>]*style="[^"]*width:75%[^"]*"[^>]*><img/);
    expect(html).toMatch(/<img[^>]*style="[^"]*width:100%/);
  });

  it('reserves the natural aspect ratio in server markup', () => {
    const html = toHTML([
      {
        altText: 'natural',
        maxWidth: 800,
        naturalHeight: 600,
        naturalWidth: 1200,
        src: 'https://cdn/natural.png',
        type: 'block-image',
        version: 1,
      },
    ]);

    expect(html).toMatch(
      /<span[^>]*style="[^"]*width:min\(800px, 100%\)[^"]*aspect-ratio:1200 \/ 600[^"]*"[^>]*><img/,
    );
  });

  it('reserves the natural aspect ratio at a percent width', () => {
    const html = toHTML([
      {
        altText: 'half',
        displayWidth: 50,
        maxWidth: 1200,
        naturalHeight: 600,
        naturalWidth: 1200,
        src: 'https://cdn/half.png',
        type: 'block-image',
        version: 1,
      },
    ]);

    expect(html).toMatch(/<span[^>]*style="[^"]*width:50%[^"]*aspect-ratio:1200 \/ 600/);
  });

  it('server-renders the thumbhash placeholder in its loading state', () => {
    const html = toHTML([
      {
        altText: 'thumb',
        maxWidth: 600,
        src: 'https://cdn/thumb.png',
        thumbhash: THUMBHASH,
        type: 'block-image',
        version: 1,
        width: 600,
      },
    ]);

    expect(html).toMatch(/<span[^>]*data-image-state="loading"[^>]*style="[^"]*background-image/);
    expect(html).toMatch(/<span[^>]*style="[^"]*aspect-ratio:/);
    expect(html).toMatch(/<img[^>]*style="[^"]*opacity:0/);
  });

  it('uses a legacy width and height as the ratio instead of a fixed height', () => {
    const html = toHTML([
      {
        altText: 'legacy',
        height: 300,
        maxWidth: 600,
        src: 'https://cdn/legacy.png',
        type: 'block-image',
        version: 1,
        width: 600,
      },
    ]);

    expect(html).toMatch(/<span[^>]*style="[^"]*aspect-ratio:600 \/ 300/);
    expect(html).not.toContain('height:300px');
  });

  it('renders a video figure with width and caption', () => {
    const html = toHTML([
      {
        caption: 'Walkthrough',
        displayWidth: 75,
        poster: 'https://cdn/poster.jpg',
        src: 'https://cdn/clip.mp4',
        type: 'video',
        version: 1,
      },
    ]);

    expect(html).toContain('<figure');
    expect(html).toMatch(/<video[^>]*src="https:\/\/cdn\/clip.mp4"/);
    expect(html).toMatch(/style="[^"]*width:75%/);
    expect(html).toMatch(/<figcaption[^>]*>Walkthrough<\/figcaption>/);
  });

  it('skips a video without a safe source', () => {
    const html = toHTML([{ src: 'javascript:alert(1)', type: 'video', version: 1 }]);

    expect(html).not.toContain('<video');
    expect(html).not.toContain('javascript:');
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
