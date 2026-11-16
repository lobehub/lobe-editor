// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createHeadlessEditor } from '..';

describe('headless alert and footnote support', () => {
  it('round-trips alerts and footnotes through Markdown and LiteXML without a DOM', () => {
    const editor = createHeadlessEditor();
    editor.hydrateMarkdown(
      '> [!NOTE]\n> Useful **info**[^1]\n\nText[^1] more[^b]\n\n[^b]: Bee\n\n[^1]: One\n',
    );
    const { editorData, litexml, markdown } = editor.export({ litexml: true });
    const children = editorData.root.children as any[];

    expect(children[0]).toMatchObject({ alertType: 'note', type: 'alert' });
    expect(children.at(-1).type).toBe('footnote-section');
    expect(children.at(-1).children.map((child: any) => child.identifier)).toEqual(['1', 'b']);
    expect(markdown).toContain('> [!NOTE]');
    expect(markdown).toContain('[^1]: One');
    expect(litexml).toMatch(/<alert id="[^"]+" type="note">/);
    expect(litexml).toMatch(/<def id="[^"]+" ref="b">/);

    editor.hydrateLiteXML(litexml!);
    expect(editor.export().markdown).toBe(markdown);
    editor.destroy();
  });
});
