import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { ImagePlugin } from '../plugin';

const THUMBHASH = '1QcSHQRnh493V4dIh4eXh1h4kJUI';

function makeState(children: any[]) {
  return {
    root: {
      children,
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  };
}

function paragraph(children: any[]) {
  return { children, direction: null, format: '', indent: 0, type: 'paragraph', version: 1 };
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

describe('image caption / thumbhash / accent', () => {
  let editor: IEditor;

  const createEditor = (defaultBlockImage = true) => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([
      LitexmlPlugin,
      MarkdownPlugin,
      CommonPlugin,
      [ImagePlugin, { defaultBlockImage }],
    ]);
    editor.initNodeEditor();
    return editor;
  };

  beforeEach(() => {
    createEditor();
  });

  it('round-trips caption, thumbhash and accent through JSON', () => {
    editor.setDocument(
      'json',
      makeState([
        {
          accent: '#336699',
          altText: 'sunset',
          caption: 'Sunset over the bay',
          maxWidth: 800,
          src: 'https://cdn/sunset.png',
          status: 'uploaded',
          thumbhash: THUMBHASH,
          type: 'block-image',
          version: 1,
        },
        paragraph([
          {
            altText: 'icon',
            caption: 'Inline icon',
            maxWidth: 64,
            src: 'https://cdn/icon.png',
            type: 'image',
            version: 1,
          },
        ]),
      ]),
    );

    const [block, inline] = findImages(editor.getDocument('json'));
    expect(block).toMatchObject({
      accent: '#336699',
      caption: 'Sunset over the bay',
      thumbhash: THUMBHASH,
      type: 'block-image',
    });
    expect(inline).toMatchObject({ caption: 'Inline icon', type: 'image' });
  });

  it('omits empty meta fields from JSON', () => {
    editor.setDocument(
      'json',
      makeState([
        { altText: 'a', maxWidth: 800, src: 'https://cdn/a.png', type: 'block-image', version: 1 },
      ]),
    );

    const [block] = findImages(editor.getDocument('json'));
    expect(block).not.toHaveProperty('caption');
    expect(block).not.toHaveProperty('thumbhash');
    expect(block).not.toHaveProperty('accent');
  });

  it('migrates a legacy nested caption editor state to plain text', () => {
    editor.setDocument(
      'json',
      makeState([
        {
          altText: 'legacy',
          caption: {
            editorState: {
              root: {
                children: [
                  paragraph([
                    { text: 'Legacy ', type: 'text' },
                    { text: 'caption', type: 'text' },
                  ]),
                ],
                type: 'root',
              },
            },
          },
          maxWidth: 800,
          showCaption: true,
          src: 'https://cdn/legacy.png',
          type: 'block-image',
          version: 1,
        },
      ]),
    );

    const [block] = findImages(editor.getDocument('json'));
    expect(block.caption).toBe('Legacy caption');
  });

  it('drops accent values that are not colors', () => {
    editor.setDocument(
      'json',
      makeState([
        {
          accent: 'red; background: url(evil)',
          altText: 'a',
          maxWidth: 800,
          src: 'https://cdn/a.png',
          type: 'block-image',
          version: 1,
        },
      ]),
    );

    expect(findImages(editor.getDocument('json'))[0]).not.toHaveProperty('accent');
  });

  it('round-trips meta through LiteXML', () => {
    editor.setDocument(
      'litexml',
      `<?xml version="1.0" encoding="UTF-8"?><root><img src="https://cdn/sunset.png" alt="sunset" caption="Sunset &amp; sea" thumbhash="${THUMBHASH}" accent="#336699"></img></root>`,
    );

    const [block] = findImages(editor.getDocument('json'));
    expect(block).toMatchObject({
      accent: '#336699',
      caption: 'Sunset & sea',
      thumbhash: THUMBHASH,
    });

    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml).toContain('caption="Sunset &amp; sea"');
    expect(xml).toContain(`thumbhash="${THUMBHASH}"`);
    expect(xml).toContain('accent="#336699"');

    createEditor();
    editor.setDocument('litexml', xml);
    expect(findImages(editor.getDocument('json'))[0]).toMatchObject({
      accent: '#336699',
      caption: 'Sunset & sea',
      thumbhash: THUMBHASH,
    });
  });

  it('round-trips meta through LiteXML for inline images', () => {
    createEditor(false);
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><p><img src="https://cdn/i.png" alt="i" caption="Inline"></img></p></root>',
    );

    const [inline] = findImages(editor.getDocument('json'));
    expect(inline).toMatchObject({ caption: 'Inline', type: 'image' });
    expect(editor.getDocument('litexml') as unknown as string).toContain('caption="Inline"');
  });

  it('maps caption to the Markdown image title', () => {
    editor.setDocument('markdown', '![logo](https://logo.com/logo.png "The \\"best\\" logo")');

    const [block] = findImages(editor.getDocument('json'));
    expect(block.caption).toBe('The "best" logo');

    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('![logo](https://logo.com/logo.png "The \\"best\\" logo")\n');

    createEditor();
    editor.setDocument('markdown', markdown);
    expect(findImages(editor.getDocument('json'))[0].caption).toBe('The "best" logo');
  });

  it('writes a plain Markdown image when there is no caption', () => {
    editor.setDocument('markdown', '![logo](https://logo.com/logo.png)');
    expect(editor.getDocument('markdown')).toBe('![logo](https://logo.com/logo.png)\n');
  });
});
