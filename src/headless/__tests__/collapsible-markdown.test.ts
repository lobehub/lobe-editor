// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createHeadlessEditor } from '..';

describe('headless collapsible Markdown', () => {
  it('round-trips nested details and escaped titles without a DOM', () => {
    const editor = createHeadlessEditor();
    editor.hydrateMarkdown(
      '<details open=""><summary>A &amp; B</summary>A &amp; B\n\n<details><summary>Inner</summary>**Body**</details>\n</details>',
    );
    const { editorData, markdown } = editor.export();
    const outer = editorData.root.children[0] as any;

    expect(outer).toMatchObject({ collapsed: false, title: 'A & B', type: 'collapsible' });
    expect(outer.children[1].children[0].text).toBe('A & B');
    expect(outer.children[2]).toMatchObject({
      collapsed: true,
      title: 'Inner',
      type: 'collapsible',
    });
    expect(markdown).toContain('<summary>A &amp; B</summary>');
    expect(markdown).toContain('**Body**');
    editor.hydrateMarkdown(markdown);
    expect(editor.export().markdown).toBe(markdown);
    editor.destroy();
  });
});
