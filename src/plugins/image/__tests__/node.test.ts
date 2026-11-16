import { $create, type Klass, type LexicalNode } from 'lexical';
import { describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';

import { BlockImageNode } from '../node/block-image-node';
import { ImageNode } from '../node/image-node';
import { ImagePlugin } from '../plugin';

describe('image nodes', () => {
  it.each<{ Klass: Klass<LexicalNode>; name: string }>([
    { Klass: ImageNode, name: 'ImageNode' },
    { Klass: BlockImageNode, name: 'BlockImageNode' },
  ])('$name can be created without constructor arguments', ({ Klass }) => {
    const editor = Editor.createEditor();
    editor.registerPlugins([MarkdownPlugin, CommonPlugin, ImagePlugin]);
    editor.initNodeEditor();

    let type: string | undefined;
    editor.getLexicalEditor()!.update(
      () => {
        type = $create(Klass).getType();
      },
      { discrete: true },
    );
    expect(type).toBe(Klass.getType());
  });
});
