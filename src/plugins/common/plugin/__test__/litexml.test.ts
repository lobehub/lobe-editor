import { beforeEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { IEditor } from '@/types';

describe('Common Plugin Tests', () => {
  let kernel: IEditor;

  beforeEach(() => {
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, LitexmlPlugin]);
    kernel.initNodeEditor();
  });

  it('should litexml reader work', () => {
    kernel.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><p id="1"><span id="2">this is </span><span id="3" underline="true">underline</span><span id="4"> and this is </span><span id="5" underline="true">underline2</span></p>',
    );
    const markdown = kernel.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('this is <ins>underline</ins> and this is <ins>underline2</ins>\n\n');
  });

  it('should litexml writer work', () => {
    kernel.setDocument('markdown', 'this is <ins>underline</ins> and this is <u>underline2</u>');
    const xml = kernel.getDocument('litexml') as unknown as string;
    expect(xml.replace(/>\n\s*?</g, '><')).toBe(
      `<?xml version="1.0" encoding="UTF-8"?><root><p id="mczm"><span id="mijx">this is </span><span id="mo48" underline="true">underline</span><span id="mtoj"> and this is </span><span id="mz8u" underline="true">underline2</span></p></root>`,
    );
  });
});
