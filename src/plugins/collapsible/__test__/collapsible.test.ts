import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

import { CollapsiblePlugin } from '../plugin';

describe('collapsible plugin', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, CollapsiblePlugin]);
    editor.initNodeEditor();
  });

  it('reads and writes litexml', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><collapsible id="1" title="More" collapsed="true"><p id="2"><span id="3">Hidden text</span></p></collapsible></root>',
    );

    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toContain('<details>');
    expect(markdown).toContain('<summary>More</summary>');
    expect(markdown).toContain('Hidden text');
  });

  it('reads markdown details blocks', () => {
    editor.setDocument(
      'markdown',
      '<details open>\n<summary>More</summary>\n\nHidden text\n</details>',
    );

    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml).toContain('<collapsible');
    expect(xml).toContain('title="More"');
    expect(xml).toContain('collapsed="false"');
  });
});
