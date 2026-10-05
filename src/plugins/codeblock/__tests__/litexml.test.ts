import { describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

import { normalizeOpaqueIds } from '../../litexml/__test__/normalize-opaque-ids';
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
    const id = /<code id="([^"]+)"/.exec(xml)?.[1];
    expect(id).toBeTruthy();
    expect(normalizeOpaqueIds(xml.replace(/>\n\s*?</g, '><'))).toBe(
      normalizeOpaqueIds(
        `<?xml version="1.0" encoding="UTF-8"?><root><code id="mczm" lang="javascript">hello\nworld</code></root>`,
      ),
    );
    expect(editor.getDocument('litexml')).toBe(xml);
    editor.setDocument('litexml', xml);
    expect(editor.getDocument('markdown')).toBe('```javascript\nhello\nworld\n```\n');
  });
});
