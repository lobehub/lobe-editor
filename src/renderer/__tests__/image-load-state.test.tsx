import type { SerializedEditorState } from 'lexical';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LexicalRenderer } from '../LexicalRenderer';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const value = {
  root: {
    children: [
      {
        altText: 'natural',
        displayWidth: 50,
        maxWidth: 800,
        naturalHeight: 600,
        naturalWidth: 1200,
        src: 'https://cdn/natural.png',
        type: 'block-image',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
} as unknown as SerializedEditorState;

describe('LexicalRenderer image load state', () => {
  let host: HTMLDivElement;
  let root: Root;
  const completeDescriptor = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    'complete',
  );

  beforeEach(() => {
    Object.defineProperty(HTMLImageElement.prototype, 'complete', {
      configurable: true,
      get: () => false,
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    if (completeDescriptor) {
      Object.defineProperty(HTMLImageElement.prototype, 'complete', completeDescriptor);
    }
  });

  const mount = async () => {
    await act(async () => {
      root.render(<LexicalRenderer value={value} />);
    });
    const image = host.querySelector<HTMLImageElement>('figure img')!;
    return { frame: image.parentElement!, image };
  };

  it('keeps the reserved frame when the image fails to load', async () => {
    const { frame, image } = await mount();

    await act(async () => {
      image.dispatchEvent(new Event('error'));
    });

    expect(frame.dataset.imageState).toBe('error');
    expect(frame.style.aspectRatio).toBe('1200 / 600');
    expect(frame.style.width).toBe('50%');
  });

  it('hands sizing back to the image once it loads', async () => {
    const { frame, image } = await mount();
    expect(frame.style.aspectRatio).toBe('1200 / 600');

    await act(async () => {
      image.dispatchEvent(new Event('load'));
    });

    expect(frame.dataset.imageState).toBe('loaded');
    expect(frame.style.aspectRatio).toBe('');
  });
});
