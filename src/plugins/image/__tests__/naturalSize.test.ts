import { $dfs } from '@lexical/utils';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { $isBlockImageNode } from '../node/block-image-node';
import { ImagePlugin } from '../plugin';

function makeState(children: any[]) {
  return {
    root: { children, direction: null, format: '', indent: 0, type: 'root', version: 1 },
  };
}

function blockImage(extra: Record<string, unknown> = {}) {
  return {
    altText: 'a',
    maxWidth: 800,
    src: 'https://cdn/a.png',
    type: 'block-image',
    version: 1,
    ...extra,
  };
}

function findImages(json: any): any[] {
  const out: any[] = [];
  const visit = (node: any) => {
    if (node.type === 'image' || node.type === 'block-image') out.push(node);
    node.children?.forEach(visit);
  };
  visit(json.root);
  return out;
}

describe('image natural size', () => {
  let editor: IEditor;

  const createEditor = () => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, ImagePlugin]);
    editor.initNodeEditor();
  };

  beforeEach(createEditor);

  it('round-trips naturalWidth and naturalHeight through JSON', () => {
    editor.setDocument('json', makeState([blockImage({ naturalHeight: 600, naturalWidth: 1200 })]));

    expect(findImages(editor.getDocument('json'))[0]).toMatchObject({
      naturalHeight: 600,
      naturalWidth: 1200,
    });
  });

  it('drops a natural size that is not a positive pair', () => {
    editor.setDocument(
      'json',
      makeState([
        blockImage({ naturalHeight: 0, naturalWidth: 1200 }),
        blockImage({ naturalHeight: Number.NaN, naturalWidth: -1 }),
      ]),
    );

    for (const image of findImages(editor.getDocument('json'))) {
      expect(image).not.toHaveProperty('naturalWidth');
      expect(image).not.toHaveProperty('naturalHeight');
    }
  });

  it('records the natural size with setNaturalSize and keeps it on clone', () => {
    editor.setDocument('json', makeState([blockImage()]));
    const lexical = editor.getLexicalEditor()!;

    lexical.update(
      () => {
        const node = $dfs()
          .map(({ node }) => node)
          .find($isBlockImageNode)!;
        node.setNaturalSize(1600, 900);
      },
      { discrete: true },
    );

    expect(findImages(editor.getDocument('json'))[0]).toMatchObject({
      naturalHeight: 900,
      naturalWidth: 1600,
    });
  });

  it('round-trips the natural size through LiteXML', () => {
    editor.setDocument('json', makeState([blockImage({ naturalHeight: 600, naturalWidth: 1200 })]));
    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml).toContain('natural-width="1200"');
    expect(xml).toContain('natural-height="600"');

    createEditor();
    editor.setDocument('litexml', xml);
    expect(findImages(editor.getDocument('json'))[0]).toMatchObject({
      naturalHeight: 600,
      naturalWidth: 1200,
    });
  });
});
