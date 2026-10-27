import { MotionProvider } from '@lobehub/ui';
import { motion } from 'motion/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ReactFootnotePlugin } from '@/plugins/footnote';
import Editor from '@/react/Editor';

import { ReactAlertPlugin } from '../react';

describe('ReactAlertPlugin and ReactFootnotePlugin in the editor', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('renders alert headers and numbered footnote references', async () => {
    await act(async () => {
      root.render(
        <MotionProvider motion={motion}>
          <Editor
            content={'> [!WARNING]\n> Careful[^a] and[^b]\n\n[^b]: Bee\n\n[^a]: Ay\n'}
            plugins={[ReactAlertPlugin, ReactFootnotePlugin]}
            type="markdown"
          />
        </MotionProvider>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const header = host.querySelector('[data-alert-header="true"]');
    expect(header?.closest('[data-alert-type]')?.getAttribute('data-alert-type')).toBe('warning');
    expect(header?.textContent).toContain('Warning');

    const references = Array.from(host.querySelectorAll('sup[data-footnote-ref]')).map(
      (reference) => reference.textContent,
    );
    expect(references).toEqual(['[1]', '[2]']);

    const definitions = Array.from(host.querySelectorAll('[data-footnote-definition]')).map(
      (definition) => definition.getAttribute('data-footnote-definition'),
    );
    expect(definitions).toEqual(['a', 'b']);
  });
});
