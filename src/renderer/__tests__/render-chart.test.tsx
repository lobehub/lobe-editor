import type { SerializedEditorState } from 'lexical';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LexicalRenderer } from '../LexicalRenderer';

vi.mock('@/plugins/chart/react/components/ChartCanvas', () => ({
  default: () => <div data-testid="canvas" />,
}));

const makeState = (node: Record<string, unknown>): SerializedEditorState =>
  ({
    root: {
      children: [{ type: 'chart', version: 1, ...node }],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }) as SerializedEditorState;

describe('LexicalRenderer chart', () => {
  it('renders title, subtitle, references, note and source around the chart', () => {
    const html = renderToStaticMarkup(
      <LexicalRenderer
        value={makeState({
          spec: {
            data: [{ q: 'Q1', v: 1 }],
            format: { unit: '%' },
            note: 'Preliminary',
            refs: [{ label: 'Target', y: 5 }],
            series: [{ key: 'v' }],
            source: 'Internal',
            subtitle: 'By quarter',
            title: 'Growth',
            type: 'bar',
            version: 1,
            x: 'q',
          },
        })}
      />,
    );

    expect(html).toContain('data-chart-type="bar"');
    expect(html).toContain('Growth');
    expect(html).toContain('By quarter');
    expect(html).toContain('Target 5%');
    expect(html).toContain('Preliminary');
    expect(html).toContain('Source: Internal');
  });

  it('renders an error card for an invalid spec without throwing', () => {
    const html = renderToStaticMarkup(
      <LexicalRenderer value={makeState({ raw: '{"type":"pie"', spec: null })} />,
    );

    expect(html).toContain('data-chart-status="error"');
    expect(html).toContain('Invalid chart');
    expect(html).toContain('Invalid JSON');
  });
});
