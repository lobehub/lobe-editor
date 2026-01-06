import { describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

import { CodePlugin } from '../plugin';

describe('codeblock litexml', () => {
  let editor: IEditor;

  beforeEach(() => {
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, CodePlugin]);
    editor.initNodeEditor();
  });

  it('reader should work', () => {
    editor.setDocument('litexml', '<codeInline id="1"><span>123</span></codeInline>');
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('`123`\n');
  });

  it('writer should work', () => {
    editor.setDocument('markdown', '`123`');
    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml.replace(/>\n\s*?</g, '><')).toBe(
      `<?xml version="1.0" encoding="UTF-8"?><root><p id="m1v0"><codeInline id="m7fb"><span id="mo48">123</span></codeInline></p></root>`,
    );
  });
});
