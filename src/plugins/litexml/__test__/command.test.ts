import { beforeEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LITEXML_INSERT_COMMAND, LITEXML_REMOVE_COMMAND, LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { IEditor } from '@/types';

function moment() {
  return new Promise((resolve) => queueMicrotask(() => resolve(true)));
}

describe('Common Plugin Tests', () => {
  let kernel: IEditor;

  beforeEach(() => {
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, LitexmlPlugin]);
    kernel.initNodeEditor();
  });

  it('should LITEXML_INSERT_COMMAND work', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<p><span bold="true">InsertedText</span></p>',
      afterId: '1',
    });
    await moment();
    const markdown = kernel.getDocument('markdown') as unknown as string;
    expect(markdown).toBe(
      '# This is a title\n\n**InsertedText**\n\nThis is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
  });

  it('should LITEXML_REMOVE_COMMAND work', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_REMOVE_COMMAND, {
      id: '10',
    });
    await moment();
    const markdown = kernel.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n');
  });
});
