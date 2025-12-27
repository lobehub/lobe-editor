import { describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

import { MentionPlugin } from '../plugin';

describe('mention litexml', () => {
  let editor: IEditor;

  beforeEach(() => {
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin]);
    editor.registerPlugin(MentionPlugin, {
      decorator: () => {},
      markdownReader(node, children) {
        if (node.value === '<mention>') {
          const text = children
            .map((child) => {
              if (child.type === 'text') {
                // @ts-expect-error not error
                return child.text;
              }
              return '';
            })
            .join('');
          return {
            type: 'mention',
            version: 1,
            label: text.split('[')[0],
            metadata: {
              id: text.split('[')[1]?.replace(']', '') || '',
            },
          };
        }
        return false;
      },
      markdownWriter(mention) {
        const name = mention.label;
        if (mention.metadata.id) {
          return `<mention>${name}[${mention.metadata.id}]</mention>`;
        }
        return `<mention>${name}</mention>`;
      },
    });
    editor.initNodeEditor();
  });

  it('reader should work', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><p><mention label="xxx"></mention></p></root>',
    );
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('<mention>xxx</mention>\n\n');
  });

  it('writer should work', async () => {
    editor.setDocument('markdown', '<mention>xxx[123]</mention>');
    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml.replace(/>\n\s*?</g, '><')).toBe(
      `<?xml version="1.0" encoding="UTF-8"?><root><p id="lwap"><mention id="m1v0" label="xxx" metadata="{&quot;id&quot;:&quot;123&quot;}"></mention></p></root>`,
    );
  });
});
