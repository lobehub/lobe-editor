import { MotionProvider } from '@lobehub/ui';
import { motion } from 'motion/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ChartToolbar from '../react/components/ChartToolbar';
import ChartConfigPanel from '../react/components/config/ChartConfigPanel';
import type { ChartSpec } from '../utils/spec';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock('@/editor-kernel/react/useTranslation', () => ({
  useTranslation: () => (key: string) => `«${key}»`,
}));

const spec: ChartSpec = {
  data: [
    { cloud: 10, q: 'Q1' },
    { cloud: 12, q: 'Q2' },
  ],
  refs: [{ label: 'Plan', y: 11 }],
  series: [{ key: 'cloud', label: 'Cloud' }],
  type: 'bar',
  version: 1,
  x: 'q',
};

let container: HTMLDivElement;
let root: Root;

const untranslated = () =>
  [...container.querySelectorAll('[aria-label]')]
    .map((element) => element.getAttribute('aria-label')!)
    .filter((label) => /(^|\s)chart\./.test(label));

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('chart accessible names', () => {
  it('names every control in the form with translated text', () => {
    act(() => {
      root.render(<ChartConfigPanel onChange={() => {}} spec={spec} />);
    });
    const tabs = ['setup', 'data', 'style'];
    const found: string[] = [];
    for (const tab of tabs) {
      act(() => {
        container
          .querySelector<HTMLButtonElement>(`[aria-label="«chart.form.tabs.${tab}»"]`)!
          .click();
      });
      found.push(...untranslated());
    }

    expect(found).toEqual([]);
  });

  it('names the source toggle in the toolbar', () => {
    act(() => {
      root.render(
        <MotionProvider motion={motion}>
          <ChartToolbar
            formOpen={false}
            onFormOpenChange={() => {}}
            onSpecChange={() => {}}
            onToggleSource={() => {}}
            showSource={false}
            spec={spec}
          />
        </MotionProvider>,
      );
    });

    expect(container.querySelector('[aria-label="«chart.editSource»"]')).not.toBeNull();
  });
});
