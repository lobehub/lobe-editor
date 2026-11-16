import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaDisplaySize } from '@/utils/mediaDisplaySize';

import MediaWidthControl from '../MediaWidthControl';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock('@/editor-kernel/react/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

let container: HTMLDivElement;
let root: Root;
let onChange: ReturnType<typeof vi.fn<(next: MediaDisplaySize) => void>>;

const render = (size: MediaDisplaySize, extra: { containerWidth?: number } = {}) => {
  act(() => {
    root.render(<MediaWidthControl onChange={onChange} size={size} {...extra} />);
  });
};

const button = (text: string) => {
  const found = [...container.querySelectorAll('button')].find(
    (el) => el.textContent?.trim() === text,
  );
  if (!found) throw new Error(`missing button ${text}`);
  return found;
};

const setInputValue = (input: HTMLInputElement, value: string) => {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  onChange = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('MediaWidthControl', () => {
  it('switches from auto to percent at 100%', () => {
    render({ mode: 'auto' });
    act(() => button('%').click());
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'percent', value: 100 });
  });

  it('converts px to percent using the container width', () => {
    render({ mode: 'px', px: 360 }, { containerWidth: 720 });
    act(() => button('%').click());
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'percent', value: 50 });
  });

  it('applies a percent preset', () => {
    render({ mode: 'percent', value: 100 });
    act(() => button('50%').click());
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'percent', value: 50 });
  });

  it('snaps slider input to presets', () => {
    render({ mode: 'percent', value: 100 });
    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    setInputValue(slider, '73');
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'percent', value: 75 });
  });

  it('commits a typed px width', () => {
    render({ mode: 'px', px: 560 });
    const input = container.querySelector<HTMLInputElement>('input[aria-label="media.widthPx"]')!;
    setInputValue(input, '480');
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'px', px: 480 });
  });

  it('ignores an invalid px width', () => {
    render({ mode: 'px', px: 560 });
    const input = container.querySelector<HTMLInputElement>('input[aria-label="media.widthPx"]')!;
    setInputValue(input, '0');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('switches back to auto', () => {
    render({ mode: 'percent', value: 50 });
    act(() => button('media.widthAuto').click());
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'auto' });
  });
});
