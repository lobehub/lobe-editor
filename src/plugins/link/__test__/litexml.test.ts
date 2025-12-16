import { describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

import { LinkPlugin } from '../plugin';

describe('link litexml', () => {
  let editor: IEditor;

  beforeEach(() => {
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, LinkPlugin]);
    editor.initNodeEditor();
  });

  it('reader should work', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><p id="1"><a id="2" href="https://logo.com/logo.png"><span id="3">logo</span></a></p></root>',
    );
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('[logo](https://logo.com/logo.png)\n\n');
  });

  it('writer should work', async () => {
    editor.setDocument('markdown', '[logo](https://logo.com/logo.png)');
    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml.replace(/>\n\s*?</g, '><')).toBe(
      `<?xml version="1.0" encoding="UTF-8"?><root><p id="m1v0"><a id="m7fb" href="https://logo.com/logo.png"><span id="mczm">logo</span></a></p></root>`,
    );
  });
});
