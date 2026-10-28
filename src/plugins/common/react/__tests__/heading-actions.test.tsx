import { MotionProvider } from '@lobehub/ui';
import { motion } from 'motion/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HEADING_HIDDEN_ATTRIBUTE } from '@/plugins/common';
import Editor from '@/react/Editor';
import type { IEditor } from '@/types';

const ACTION_SELECTOR = '[data-heading-actions] > *';

describe('heading actions', () => {
  let host: HTMLDivElement;
  let root: Root;
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const renderEditor = (props: Record<string, unknown> = {}) => {
    let editor: IEditor | undefined;
    act(() => {
      root.render(
        <MotionProvider motion={motion}>
          <Editor
            content={'# Getting Started\n\nIntro text\n\n# Getting Started\n\nMore text\n'}
            onInit={(next) => {
              editor = next;
            }}
            type="markdown"
            {...props}
          />
        </MotionProvider>,
      );
    });
    return editor!;
  };

  const hoverHeading = (heading: Element) => {
    act(() => {
      heading.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    });
  };

  it('gives headings unique ids in the editor', () => {
    renderEditor();
    const headings = host.querySelectorAll('h1');

    expect(headings[0].id).toBe('getting-started');
    expect(headings[1].id).toBe('getting-started-1');
  });

  it('copies the heading link built by getHeadingLink', async () => {
    const getHeadingLink = vi.fn((slug: string) => `https://example.com/page#${slug}`);
    renderEditor({ getHeadingLink });

    hoverHeading(host.querySelectorAll('h1')[1]);
    const buttons = host.querySelectorAll(ACTION_SELECTOR);
    expect(buttons.length).toBe(2);

    await act(async () => {
      (buttons[1] as HTMLElement).click();
    });

    expect(getHeadingLink).toHaveBeenCalledWith('getting-started-1');
    expect(writeText).toHaveBeenCalledWith('https://example.com/page#getting-started-1');
  });

  it('folds and unfolds the section under a heading without changing the document', () => {
    const editor = renderEditor();
    const markdown = editor.getDocument('markdown');
    const json = JSON.stringify(editor.getDocument('json'));

    hoverHeading(host.querySelector('h1')!);
    const foldButton = host.querySelector(ACTION_SELECTOR) as HTMLElement;
    act(() => foldButton.click());

    const paragraphs = host.querySelectorAll('p');
    expect(paragraphs[0].getAttribute(HEADING_HIDDEN_ATTRIBUTE)).toBe('true');
    expect(paragraphs[1].hasAttribute(HEADING_HIDDEN_ATTRIBUTE)).toBe(false);
    expect(editor.getDocument('markdown')).toBe(markdown);
    expect(JSON.stringify(editor.getDocument('json'))).toBe(json);

    act(() => foldButton.click());
    expect(paragraphs[0].hasAttribute(HEADING_HIDDEN_ATTRIBUTE)).toBe(false);
  });

  it('can opt out of heading anchors and folding', () => {
    renderEditor({ enableHeadingAnchor: false, enableHeadingFold: false });
    const heading = host.querySelector('h1')!;
    hoverHeading(heading);

    expect(heading.hasAttribute('id')).toBe(false);
    expect(host.querySelector('[data-heading-actions]')).toBeNull();
  });
});
