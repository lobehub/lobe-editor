import { describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

import { CodeblockPlugin } from '../plugin';

describe('codeblock litexml', () => {
  let editor: IEditor;

  beforeEach(() => {
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, CodeblockPlugin]);
    editor.initNodeEditor();
  });

  it('reader should work', () => {
    editor.setDocument('litexml', '<code lang="js">hello\nworld</code>');
    const json = editor.getDocument('markdown') as unknown as string;
    expect(json).toEqual('```js\nhello\nworld\n```\n');
  });

  it('writer should work', () => {
    editor.setDocument('markdown', '```js\nhello\nworld\n```');
    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml.replace(/>\n\s*?</g, '><')).toBe(
      `<?xml version="1.0" encoding="UTF-8"?><root><code id="6" lang="javascript">hello\nworld</code></root>`,
    );
  });
});
