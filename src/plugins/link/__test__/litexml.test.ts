import { describe, expect, it } from 'vitest';

import Editor, { resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

import { LinkPlugin } from '../plugin';

describe('link litexml', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, LinkPlugin]);
    editor.initNodeEditor();
  });

  it('reader should work', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><p id="1"><a id="2" href="https://logo.com/logo.png"><span id="3">logo</span></a></p></root>',
    );
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('[logo](https://logo.com/logo.png)\n');
  });

  it('writer should work', async () => {
    editor.setDocument('markdown', '[logo](https://logo.com/logo.png)');
    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml.replace(/>\n\s*?</g, '><')).toBe(
      `<?xml version="1.0" encoding="UTF-8"?><root><p id="ll63"><a id="lqqe" href="https://logo.com/logo.png"><span id="lwap">logo</span></a></p></root>`,
    );
  });

  it('new link display nodes should write markdown as normal links', () => {
    editor.setDocument('json', {
      root: {
        children: [
          {
            description: 'Home page',
            icon: '',
            openTarget: '_self',
            title: 'Card title',
            type: 'link-card',
            url: 'https://lobehub.com',
            version: 1,
          },
          {
            src: 'https://lobehub.com',
            title: 'Iframe title',
            type: 'link-iframe',
            url: 'https://lobehub.com/embed',
            version: 1,
          },
          {
            payload: { id: '123' },
            schemaType: 'card',
            title: 'Schema title',
            type: 'schema-link',
            url: 'schema://card/123',
            version: 1,
          },
        ],
        direction: 'ltr',
        type: 'root',
        version: 1,
      },
    });

    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toBe(
      '[Card title](https://lobehub.com)\n' +
        '[Iframe title](https://lobehub.com/embed)\n' +
        '[Schema title](schema://card/123)\n',
    );
  });

  it('new link display nodes should read and write litexml', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root>' +
        '<link-card id="1" href="https://lobehub.com" title="Card title" description="Home page" openTarget="_self"/>' +
        '<link-iframe id="2" href="https://lobehub.com/embed" ' +
        'src="https://lobehub.com" title="Iframe title"/>' +
        '<schema-link id="3" href="schema://card/123" schemaType="card" ' +
        'title="Schema title" payload="{&quot;id&quot;:&quot;123&quot;}"/>' +
        '</root>',
    );

    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toBe(
      '[Card title](https://lobehub.com)\n' +
        '[Iframe title](https://lobehub.com/embed)\n' +
        '[Schema title](schema://card/123)\n',
    );

    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml).toContain('<link-card');
    expect(xml).toContain('openTarget="_self"');
    expect(xml).toContain('<link-iframe');
    expect(xml).toContain('<schema-link');
  });
});
