import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import ChartCanvas from '../react/components/ChartCanvas';
import { type ChartSpec, parseChartSpec } from '../utils/spec';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const toSpec = (input: Record<string, unknown>): ChartSpec => {
  const result = parseChartSpec({
    data: [
      { a: 1, b: 2, x: 'one' },
      { a: 3, b: 4, x: 'two' },
    ],
    series: [{ key: 'a', label: 'A' }, { key: 'b' }],
    version: 1,
    x: 'x',
    ...input,
  });
  if (!result.ok) throw new Error(result.error);
  return result.spec;
};

describe('ChartCanvas', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it.each([
    { stacked: true, type: 'bar' },
    { format: { unit: '%' }, highlight: 'b', type: 'line', y: { max: 10, min: 0 } },
    { stacked: true, type: 'area', xLabel: 'Step' },
    { donut: true, type: 'pie' },
    { type: 'pie' },
  ])('renders %j with @lobehub/charts', async (input) => {
    await act(async () => {
      root.render(<ChartCanvas height={200} spec={toSpec(input)} />);
    });
    expect(host.firstElementChild).not.toBeNull();
  });
});
