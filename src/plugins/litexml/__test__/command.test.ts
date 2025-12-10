import { beforeEach, describe, expect, it, vi } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import {
  LITEXML_APPLY_COMMAND,
  LITEXML_INSERT_COMMAND,
  LITEXML_REMOVE_COMMAND,
  LitexmlPlugin,
} from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { IEditor } from '@/types';

describe('Common Plugin Tests', () => {
  let kernel: IEditor;

  beforeEach(() => {
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, LitexmlPlugin]);
    kernel.initNodeEditor();
  });

  it('should LITEXML_APPLY_COMMAND work', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    console.info(kernel.getDocument('litexml'));
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: ['<span id="lqqe">ModifiedText</span>', '<span id="m1v0">THIS IS </span>'],
    });
    await moment();
    const markdown = kernel.getDocument('markdown') as unknown as string;
    expect(markdown).toBe(
      '# ModifiedText\n\nTHIS IS <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
  });

  it('should LITEXML_INSERT_COMMAND work', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<p><span bold="true">InsertedText</span></p>',
      afterId: '10',
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
      id: '19',
    });
    await moment();
    const markdown = kernel.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n');
  });
});
