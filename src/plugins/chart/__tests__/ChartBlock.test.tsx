import { MotionProvider } from '@lobehub/ui';
import type { LexicalEditor } from 'lexical';
import { $getRoot, UNDO_COMMAND } from 'lexical';
import { motion } from 'motion/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { $isChartNode, type ChartNode } from '../node/ChartNode';
import { ChartPlugin } from '../plugin';
import ChartBlock from '../react/components/ChartBlock';
import { toCdata } from '../utils/serialize';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock('@lobehub/ui', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ActionIcon: ({ onClick, title }: { onClick?: () => void; title?: string }) => (
    <button aria-label={title} onClick={onClick} type="button" />
  ),
}));

vi.mock('@/editor-kernel/react/useLexicalNodeSelection', () => ({
  useLexicalNodeSelection: () => [false, vi.fn(), vi.fn(), false],
}));

vi.mock('@/editor-kernel/react/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('../react/components/ChartCanvas', () => ({
  default: ({ spec }: { spec: { type: string } }) => <div data-testid="canvas">{spec.type}</div>,
}));

const spec = {
  data: [{ month: 'Jan', revenue: 1 }],
  series: [{ key: 'revenue' }],
  title: 'Original',
  type: 'bar',
  version: 1,
  x: 'month',
};

function setTextAreaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function findButton(host: HTMLElement, text: string) {
  return [...host.querySelectorAll('button')].find(
    (button) => button.textContent === text || button.getAttribute('aria-label') === text,
  )!;
}

describe('ChartBlock', () => {
  let kernel: IEditor;
  let lexical: LexicalEditor;
  let host: HTMLDivElement;
  let root: Root;

  const getNode = () =>
    lexical.getEditorState().read(() => $getRoot().getChildren().find($isChartNode)!) as ChartNode;

  const readSpec = () => lexical.getEditorState().read(() => getNode().spec);

  beforeEach(() => {
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, LitexmlPlugin, ChartPlugin]);
    kernel.initNodeEditor();
    lexical = kernel.getLexicalEditor()!;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const renderBlock = async () => {
    await act(async () => {
      root.render(
        <MotionProvider motion={motion}>
          <ChartBlock editor={lexical} node={getNode()} />
        </MotionProvider>,
      );
    });
  };

  it('renders the chart lazily with its title', async () => {
    kernel.setDocument('litexml', `<root><chart>${toCdata(JSON.stringify(spec))}</chart></root>`);
    await renderBlock();

    expect(host.textContent).toContain('Original');
    expect(host.querySelector('[data-testid="canvas"]')?.textContent).toBe('bar');
  });

  it('shows an error card with the reason for an invalid spec', async () => {
    kernel.setDocument('litexml', '<root><chart><![CDATA[{"type":"radar"}]]></chart></root>');
    await renderBlock();

    const card = host.querySelector('[data-chart-status="error"]');
    expect(card?.textContent).toContain('"type" must be one of');
    expect(card?.textContent).toContain('{"type":"radar"}');
  });

  it('keeps the previous chart when invalid JSON is applied, then applies valid JSON', async () => {
    kernel.setDocument('litexml', `<root><chart>${toCdata(JSON.stringify(spec))}</chart></root>`);
    await renderBlock();

    await act(async () => findButton(host, 'chart.editSource').click());
    const textarea = host.querySelector('textarea')!;
    expect(JSON.parse(textarea.value).title).toBe('Original');

    await act(async () => setTextAreaValue(textarea, '{"type": "bar",'));
    await act(async () => findButton(host, 'chart.apply').click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Invalid JSON');
    expect(readSpec()?.title).toBe('Original');

    await act(async () => setTextAreaValue(textarea, JSON.stringify({ ...spec, title: 'Next' })));
    await act(async () => findButton(host, 'chart.apply').click());
    expect(readSpec()?.title).toBe('Next');
    expect(host.querySelector('textarea')).toBeNull();
  });

  it('edits the chart through the visual form', async () => {
    kernel.setDocument('litexml', `<root><chart>${toCdata(JSON.stringify(spec))}</chart></root>`);
    await renderBlock();

    await act(async () => findButton(host, 'chart.editChart').click());
    const typeButton = document.querySelector<HTMLButtonElement>('[aria-label="chart.type.line"]');
    expect(typeButton).not.toBeNull();
    await act(async () => typeButton!.click());

    expect(readSpec()?.type).toBe('line');
  });

  it('undoes each form change as its own step', async () => {
    kernel.setDocument('litexml', `<root><chart>${toCdata(JSON.stringify(spec))}</chart></root>`);
    await renderBlock();

    await act(async () => findButton(host, 'chart.editChart').click());
    await act(async () =>
      document.querySelector<HTMLButtonElement>('[aria-label="chart.type.line"]')!.click(),
    );
    await act(async () =>
      document.querySelector<HTMLButtonElement>('[aria-label="chart.type.area"]')!.click(),
    );
    expect(readSpec()?.type).toBe('area');

    await act(async () => {
      lexical.dispatchCommand(UNDO_COMMAND, undefined);
    });
    expect(readSpec()?.type).toBe('line');
  });

  it('opens the JSON editor from Edit chart when the stored spec is invalid', async () => {
    kernel.setDocument('litexml', '<root><chart><![CDATA[{"type":"radar"}]]></chart></root>');
    await renderBlock();

    await act(async () => findButton(host, 'chart.editChart').click());
    expect(host.querySelector('textarea')).not.toBeNull();
    expect(document.querySelector('[aria-label="chart.type.line"]')).toBeNull();
  });

  it('shows no editing toolbar in a read-only editor', async () => {
    kernel.setDocument('litexml', `<root><chart>${toCdata(JSON.stringify(spec))}</chart></root>`);
    lexical.setEditable(false);
    await renderBlock();

    expect(findButton(host, 'chart.editChart')).toBeUndefined();
    expect(findButton(host, 'chart.editSource')).toBeUndefined();
  });
});
