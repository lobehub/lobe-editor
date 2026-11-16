// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createHeadlessEditor } from '..';

describe('headless page nodes', () => {
  it('round-trips check lists and table column alignment through LiteXML without a DOM', () => {
    const editor = createHeadlessEditor();
    editor.hydrateMarkdown(
      '- [x] shipped\n- [ ] pending\n\n| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |\n',
    );

    const { litexml } = editor.export({ litexml: true });
    expect(litexml).toMatch(/<ul[^>]* type="check"/);
    expect(litexml).toContain('checked="true"');
    expect(litexml).toContain('checked="false"');
    expect(litexml).toContain('colAligns="left,center,right"');

    editor.hydrateLiteXML(litexml!);
    const { markdown } = editor.export();
    expect(markdown).toContain('- [x] shipped');
    expect(markdown).toContain('- [ ] pending');
    expect(markdown).toMatch(/\| :-+ \| :-+: \| -+: \|/);
    expect(editor.export({ litexml: true }).litexml).toBe(litexml);
    editor.destroy();
  });
});
