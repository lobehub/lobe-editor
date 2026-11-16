// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createHeadlessEditor } from '..';

const spec = {
  data: [
    { region: 'EU', share: 40 },
    { region: 'US', share: 60 },
  ],
  donut: true,
  series: [{ key: 'share' }],
  type: 'pie',
  version: 1,
  x: 'region',
};

describe('headless chart', () => {
  it('hydrates LiteXML charts and exports Markdown and LiteXML without a DOM', () => {
    const editor = createHeadlessEditor();
    editor.hydrateLiteXML(`<root><chart><![CDATA[${JSON.stringify(spec)}]]></chart></root>`);
    const { editorData, litexml, markdown } = editor.export({ litexml: true });

    expect(editorData.root.children[0]).toMatchObject({ spec: { donut: true }, type: 'chart' });
    expect(markdown.startsWith('```chart\n')).toBe(true);
    expect(litexml).toContain('<![CDATA[');

    editor.hydrateMarkdown(markdown);
    expect((editor.export().editorData.root.children[0] as any).spec).toEqual(
      (editorData.root.children[0] as any).spec,
    );
    editor.destroy();
  });

  it('applies a chart inserted by an AI through LiteXML', async () => {
    const editor = createHeadlessEditor();
    editor.hydrateMarkdown('# Report\n');
    const id = /<h1 id="([^"]+)"/.exec(editor.export({ litexml: true }).litexml!)![1];

    await editor.applyLiteXML({
      action: 'insert',
      afterId: id,
      litexml: `<chart><![CDATA[${JSON.stringify({ ...spec, title: 'Share' })}]]></chart>`,
    });

    const { markdown } = editor.export();
    expect(markdown).toContain('```chart');
    expect(markdown).toContain('"title": "Share"');
    editor.destroy();
  });
});
