// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createHeadlessEditor } from '..';

describe('headless video', () => {
  it('round-trips a markdown video through json, markdown and litexml without a DOM', () => {
    const editor = createHeadlessEditor();
    editor.hydrateMarkdown(
      'Intro\n\n<video src="https://cdn.test/a.mp4" title="Cap" style="width: 50%" controls></video>\n',
    );
    const { editorData, litexml, markdown } = editor.export({ litexml: true });

    expect(editorData.root.children[1]).toMatchObject({
      caption: 'Cap',
      displayWidth: 50,
      src: 'https://cdn.test/a.mp4',
      type: 'video',
    });
    expect(markdown).toContain(
      '<video src="https://cdn.test/a.mp4" title="Cap" style="width: 50%" controls></video>',
    );
    expect(litexml).toContain('display-width="50"');
    editor.destroy();
  });
});
