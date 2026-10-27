import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ChartConfigPanel from '../react/components/config/ChartConfigPanel';
import type { ChartSpec } from '../utils/spec';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock('@/editor-kernel/react/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

const spec: ChartSpec = {
  data: [
    { cloud: 10, q: 'Q1' },
    { cloud: 12, q: 'Q2' },
  ],
  series: [{ key: 'cloud', label: 'Cloud' }],
  type: 'bar',
  version: 1,
  x: 'q',
};

let container: HTMLDivElement;
let root: Root;
let onChange: ReturnType<typeof vi.fn<(next: ChartSpec) => void>>;

const render = (value: ChartSpec = spec) => {
  act(() => {
    root.render(<ChartConfigPanel onChange={onChange} spec={value} />);
  });
};

const byLabel = <T extends HTMLElement>(label: string) => {
  const element = container.querySelector<T>(`[aria-label="${label}"]`);
  if (!element) throw new Error(`missing ${label}`);
  return element;
};

const typeInto = (input: HTMLInputElement, value: string, key = 'Enter') => {
  act(() => {
    input.focus();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  });
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }));
  });
  act(() => {
    input.blur();
  });
};

const openTab = (name: string) => {
  act(() => {
    byLabel<HTMLButtonElement>(name).click();
  });
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  onChange = vi.fn<(next: ChartSpec) => void>();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ChartConfigPanel', () => {
  it('changes the chart type from the setup tab', () => {
    render();
    act(() => {
      byLabel<HTMLButtonElement>('chart.type.line').click();
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'line' }));
  });

  it('adds a series from the setup tab', () => {
    render();
    act(() => {
      byLabel<HTMLButtonElement>('chart.form.addSeries').click();
    });
    expect(onChange.mock.lastCall?.[0].series.map((item) => item.key)).toEqual([
      'cloud',
      'series_2',
    ]);
  });

  it('commits a numeric cell on Enter in the data tab', () => {
    render();
    openTab('chart.form.tabs.data');
    typeInto(byLabel<HTMLInputElement>('cloud 1'), '42');
    expect(onChange.mock.lastCall?.[0].data[0].cloud).toBe(42);
  });

  it('reverts an invalid number without calling onChange', () => {
    render();
    openTab('chart.form.tabs.data');
    const cell = byLabel<HTMLInputElement>('cloud 1');
    typeInto(cell, 'abc');
    expect(onChange).not.toHaveBeenCalled();
    expect(cell.value).toBe('10');
  });

  it('reverts on Escape', () => {
    render();
    openTab('chart.form.tabs.data');
    const cell = byLabel<HTMLInputElement>('cloud 1');
    typeInto(cell, '99', 'Escape');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renames a field from the data header', () => {
    render();
    openTab('chart.form.tabs.data');
    typeInto(byLabel<HTMLInputElement>('chart.form.fieldName cloud'), 'saas');
    const next = onChange.mock.lastCall?.[0];
    expect(next?.series[0].key).toBe('saas');
    expect(next?.data[1].saas).toBe(12);
  });

  it('sets the title from the style tab', () => {
    render();
    openTab('chart.form.tabs.style');
    typeInto(byLabel<HTMLInputElement>('chart.form.title'), 'Revenue');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Revenue' }));
  });
});
