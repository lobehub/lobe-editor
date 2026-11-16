import { $nodesOfType } from 'lexical';
import { describe, expect, it, vi } from 'vitest';

import Editor, { moment, resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { CursorNode } from '@/plugins/common/node/cursor';
import { HoleNode } from '@/plugins/common/node/hole';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

import { normalizeOpaqueIds } from '../../litexml/__test__/normalize-opaque-ids';
import { BlockImageNode } from '../node/block-image-node';
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
    expect(normalizeOpaqueIds(xml.replace(/>\n\s*?</g, '><'))).toBe(
      normalizeOpaqueIds(
        `<?xml version="1.0" encoding="UTF-8"?><root><img id="lqqe" block="true" src="https://logo.com/logo.png" alt="logo" width="inherit" max-width="4200"></img></root>`,
      ),
    );
    expect(xml).not.toContain('hole');
    expect(xml).not.toContain('cursor');
    await moment();
    expect(editor.getDocument('litexml')).toBe(xml);
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(BlockImageNode)).toHaveLength(1);
        expect($nodesOfType(HoleNode)).toHaveLength(1);
        expect($nodesOfType(CursorNode)).toHaveLength(2);
      });
  });

  it('keeps inline images inside paragraphs when block images are disabled', () => {
    const inlineEditor = Editor.createEditor();
    inlineEditor.registerPlugins([
      LitexmlPlugin,
      MarkdownPlugin,
      CommonPlugin,
      [ImagePlugin, { defaultBlockImage: false }],
    ]);
    inlineEditor.initNodeEditor();
    inlineEditor.setDocument('markdown', '![logo](https://logo.com/logo.png)');

    const xml = inlineEditor.getDocument('litexml') as unknown as string;
    expect(xml).toContain('<p');
    expect(xml).toContain('<img');
    expect(xml).not.toContain('block="true"');
    inlineEditor.destroy();
  });
});
