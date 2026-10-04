import { MotionProvider } from '@lobehub/ui';
import { motion } from 'motion/react';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import SendButton from '../SendButton';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('SendButton', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const render = (node: React.ReactNode) =>
    act(() => {
      root.render(<MotionProvider motion={motion}>{node}</MotionProvider>);
    });

  it('forwards ref and trigger props so a wrapping Tooltip can attach', () => {
    const ref = createRef<HTMLButtonElement>();
    let entered = 0;
    render(
      <SendButton
        data-testid={'send'}
        onMouseEnter={() => {
          entered += 1;
        }}
        ref={ref}
      />,
    );

    const el = host.querySelector('[data-testid="send"]');
    expect(el).not.toBeNull();
    expect(ref.current).toBe(el);
    act(() => {
      el!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    expect(entered).toBe(1);
  });

  it('forwards ref to the send part when a menu is set', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <SendButton data-testid={'send'} menu={{ items: [{ key: 'a', label: 'A' }] }} ref={ref} />,
    );

    const el = host.querySelector('[data-testid="send"]');
    expect(el).not.toBeNull();
    expect(ref.current).toBe(el);
  });
});
