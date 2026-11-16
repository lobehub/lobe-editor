import { DOMParser } from '@xmldom/xmldom';
import { $getRoot } from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CodeblockPlugin } from '@/plugins/codeblock';
import { CommonPlugin } from '@/plugins/common';
import { LITEXML_APPLY_COMMAND, LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { INSERT_CHART_COMMAND, UPDATE_CHART_COMMAND } from '../command';
import { $isChartNode } from '../node/ChartNode';
import { ChartPlugin } from '../plugin';
import { toCdata } from '../utils/serialize';
import { stringifyChartSpec } from '../utils/spec';

const spec = {
  version: 1,
  type: 'line',
  title: 'Signups',
  x: 'week',
  series: [{ key: 'signups', label: 'Signups' }],
  format: { compact: true },
  refs: [{ label: 'Goal', y: 30 }],
  data: [
    { week: 'W1', signups: 12 },
    { week: 'W2', signups: 25 },
  ],
} as const;

const tricky = {
  ...spec,
  note: 'Contains ]]> and <b>&amp;</b> and ``` fences',
};

const json = (editor: IEditor) => editor.getDocument('json') as any;
const xml = (editor: IEditor) => editor.getDocument('litexml') as unknown as string;
const md = (editor: IEditor) => editor.getDocument('markdown') as unknown as string;

function chartNodes(editor: IEditor) {
  return json(editor).root.children.filter((node: any) => node.type === 'chart');
}

function chartXmlText(source: string) {
  const document = new DOMParser().parseFromString(source, 'text/xml');
  return document.getElementsByTagName('chart').item(0)?.textContent ?? null;
}

describe('ChartPlugin', () => {
  let editor: IEditor;

  beforeEach(() => {
    editor = Editor.createEditor();
    editor.registerPlugins([
      CommonPlugin,
      MarkdownPlugin,
      LitexmlPlugin,
      CodeblockPlugin,
      ChartPlugin,
    ]);
    editor.initNodeEditor();
  });

  it('inserts the default chart and updates it by key', async () => {
    editor.dispatchCommand(INSERT_CHART_COMMAND, undefined);
    await moment();
    const [inserted] = chartNodes(editor);
    expect(inserted.spec).toMatchObject({ type: 'bar', version: 1 });

    const key = editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => $getRoot().getChildren().find($isChartNode)!.getKey());
    expect(editor.dispatchCommand(UPDATE_CHART_COMMAND, { key, spec: '{"type":"nope"}' })).toBe(
      false,
    );
    editor.dispatchCommand(UPDATE_CHART_COMMAND, { key, spec: JSON.stringify(spec) });
    await moment();
    expect(chartNodes(editor)[0].spec).toMatchObject({ title: 'Signups', type: 'line' });
  });

  it('reads and writes LiteXML with CDATA', () => {
    editor.setDocument(
      'litexml',
      `<root><chart><![CDATA[${JSON.stringify(spec)}]]></chart></root>`,
    );
    const [node] = chartNodes(editor);
    expect(node.spec).toMatchObject({ refs: [{ label: 'Goal', y: 30 }], title: 'Signups' });

    const output = xml(editor);
    expect(output).toMatch(/<chart id="[^"]+"><!\[CDATA\[/);
    expect(JSON.parse(chartXmlText(output)!)).toEqual(node.spec);
  });

  it('escapes CDATA terminators and survives repeated LiteXML round-trips', () => {
    editor.setDocument('litexml', `<root><chart>${toCdata(JSON.stringify(tricky))}</chart></root>`);
    expect(chartNodes(editor)[0].spec.note).toBe(tricky.note);

    for (let round = 0; round < 3; round++) {
      editor.setDocument('litexml', xml(editor));
      expect(chartNodes(editor)[0].spec.note).toBe(tricky.note);
    }
  });

  it('accepts plain text JSON without CDATA', () => {
    editor.setDocument('litexml', `<root><chart>${JSON.stringify(spec)}</chart></root>`);
    expect(chartNodes(editor)[0].spec.title).toBe('Signups');
  });

  it('keeps invalid LiteXML specs as raw text and writes them back unchanged', () => {
    const raw = '{"type":"radar","x":"a"}';
    editor.setDocument('litexml', `<root><chart><![CDATA[${raw}]]></chart></root>`);
    const [node] = chartNodes(editor);
    expect(node).toMatchObject({ raw, spec: null });
    expect(chartXmlText(xml(editor))).toBe(raw);
    expect(md(editor)).toContain(`\`\`\`chart\n${raw}\n\`\`\``);
  });

  it('replaces a chart through LITEXML_APPLY_COMMAND', async () => {
    editor.setDocument(
      'litexml',
      `<root><chart><![CDATA[${JSON.stringify(spec)}]]></chart></root>`,
    );
    const id = new DOMParser()
      .parseFromString(xml(editor), 'text/xml')
      .getElementsByTagName('chart')
      .item(0)!
      .getAttribute('id');

    editor.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: `<chart id="${id}"><![CDATA[${JSON.stringify({ ...spec, title: 'Updated' })}]]></chart>`,
    });
    await moment();
    expect(chartNodes(editor)[0].spec.title).toBe('Updated');
  });

  it('reads and writes Markdown fenced chart blocks', () => {
    editor.setDocument('markdown', `Intro\n\n\`\`\`chart\n${JSON.stringify(spec)}\n\`\`\`\n`);
    const [node] = chartNodes(editor);
    expect(node.spec.title).toBe('Signups');

    const output = md(editor);
    expect(output).toContain(`\`\`\`chart\n${stringifyChartSpec(node.spec)}\n\`\`\``);
    editor.setDocument('markdown', output);
    expect(chartNodes(editor)[0].spec).toEqual(node.spec);
  });

  it('uses a longer fence when the JSON contains backticks', () => {
    editor.setDocument('litexml', `<root><chart>${toCdata(JSON.stringify(tricky))}</chart></root>`);
    const output = md(editor);
    expect(output.startsWith('````chart\n')).toBe(true);
    editor.setDocument('markdown', output);
    expect(chartNodes(editor)[0].spec.note).toBe(tricky.note);
  });

  it('leaves other fenced code blocks to the code block plugin', () => {
    editor.setDocument('markdown', '```js\nconst a = 1;\n```\n');
    expect(chartNodes(editor)).toHaveLength(0);
    expect(json(editor).root.children[0].type).toBe('code');
  });

  it('round-trips through JSON and revalidates stored specs', () => {
    editor.setDocument(
      'litexml',
      `<root><chart><![CDATA[${JSON.stringify(spec)}]]></chart></root>`,
    );
    const state = json(editor);
    editor.setDocument('json', state);
    expect(chartNodes(editor)[0].spec).toEqual(state.root.children[0].spec);

    state.root.children[0].spec = { ...spec, type: 'radar' };
    editor.setDocument('json', state);
    const [node] = chartNodes(editor);
    expect(node.spec).toBeNull();
    expect(JSON.parse(node.raw).type).toBe('radar');
  });
});
