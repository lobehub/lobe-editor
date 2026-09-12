import { $nodesOfType } from 'lexical';
import { describe, expect, it } from 'vitest';

import Editor, { moment, resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { CursorNode } from '@/plugins/common/node/cursor';
import { HoleNode } from '@/plugins/common/node/hole';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

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
    const immediateXML = editor.getDocument('litexml') as unknown as string;
    const readImageState = () =>
      editor
        .getLexicalEditor()!
        .getEditorState()
        .read(() => {
          const image = $nodesOfType(BlockImageNode)[0];
          return {
            cursorCount: $nodesOfType(CursorNode).length,
            height: image?.height,
            holeCount: $nodesOfType(HoleNode).length,
            key: image?.getKey(),
            maxWidth: image?.maxWidth,
            src: image?.src,
            altText: image?.altText,
            width: image?.width,
          };
        });
    const immediateState = readImageState();

    await moment();

    const stableXML = editor.getDocument('litexml') as unknown as string;
    const stableState = readImageState();
    expect(immediateXML.replaceAll(/>\n\s*?</g, '><')).toBe(
      `<?xml version="1.0" encoding="UTF-8"?><root><img id="lqqe" block="true" src="https://logo.com/logo.png" alt="logo" width="inherit" max-width="4200"></img></root>`,
    );
    expect(stableXML).toBe(immediateXML);
    expect(immediateXML).not.toContain('hole');
    expect(immediateXML).not.toContain('cursor');
    expect(stableState).toEqual(immediateState);
    expect(immediateState).toMatchObject({
      altText: 'logo',
      cursorCount: 2,
      height: 'inherit',
      holeCount: 1,
      maxWidth: 4200,
      src: 'https://logo.com/logo.png',
      width: 'inherit',
    });
  });

  it('keeps an inline image inside its paragraph when block images are disabled', () => {
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
