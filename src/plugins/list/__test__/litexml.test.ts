import { describe, expect, it, vi } from 'vitest';

import Editor, { resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

import { ListPlugin } from '../plugin';

describe('list litexml', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, ListPlugin]);
    editor.initNodeEditor();
  });

  it('reader should work', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><ul id="1"><li id="2"><span id="3">asdf</span></li><li id="4"><span id="5">qwer</span></li></ul></root>',
    );
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('- asdf\n- qwer\n');
  });

  it('writer should work', async () => {
    editor.setDocument('markdown', '- asdf\n- qwer');
    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml.replace(/>\n\s*?</g, '><')).toBe(
      `<?xml version="1.0" encoding="UTF-8"?><root><ul id="ll63"><li id="lqqe"><span id="lwap">asdf</span></li><li id="m1v0"><span id="m7fb">qwer</span></li></ul></root>`,
    );
  });
});
