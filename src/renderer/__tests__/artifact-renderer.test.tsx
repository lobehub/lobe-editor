import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LexicalRenderer } from '../LexicalRenderer';

const rootWith = (child: Record<string, unknown>) => ({
  root: {
    children: [child],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
});

describe('LexicalRenderer Artifact support', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses and renders a standalone Artifact as a sandboxed preview', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const html = renderToStaticMarkup(
      <LexicalRenderer
        value={
          rootWith({
            html: '<main>standalone</main>',
            title: 'Standalone',
            type: 'artifact',
            version: 1,
          }) as any
        }
      />,
    );

    expect(consoleError).not.toHaveBeenCalled();
    expect(html).toContain('editor_artifact_preview');
    expect(html).toContain('sandbox=""');
    expect(html).toContain('srcDoc="&lt;main&gt;standalone&lt;/main&gt;"');
  });

  it('keeps Hole transparent while rendering its Artifact payload', () => {
    const html = renderToStaticMarkup(
      <LexicalRenderer
        value={
          rootWith({
            children: [
              { text: '\uFEFF', type: 'cursor', version: 1 },
              { html: '<main>nested</main>', title: 'Nested', type: 'artifact', version: 1 },
              { text: '\uFEFF', type: 'cursor', version: 1 },
            ],
            type: 'hole',
            version: 1,
          }) as any
        }
      />,
    );

    expect(html).toContain('editor_artifact_preview');
    expect(html).not.toContain('Unknown node type');
    expect(html).not.toContain('\uFEFF');
  });
});
