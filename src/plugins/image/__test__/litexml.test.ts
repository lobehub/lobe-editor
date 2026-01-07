import { describe, expect, it, vi } from 'vitest';

import Editor, { moment, resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

import { ImagePlugin } from '../plugin';

describe('image litexml', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, ImagePlugin]);
    editor.initNodeEditor();
  });

  it('reader should work', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><p id="3"><img id="4" src="https://logo.com/logo.png" alt="logo"></img></p></root>',
    );
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('![logo](https://logo.com/logo.png)\n');
  });

  it('writer should work', async () => {
    editor.setDocument('markdown', '![logo](https://logo.com/logo.png)');
    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml.replace(/>\n\s*?</g, '><')).toBe(
      `<?xml version="1.0" encoding="UTF-8"?><root><p id="ll63"><img id="lqqe" block="true" src="https://logo.com/logo.png" alt="logo" width="inherit" max-width="4200"></img></p></root>`,
    );
  });
});
