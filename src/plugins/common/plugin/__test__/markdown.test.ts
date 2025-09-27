import { IS_BOLD, IS_UNDERLINE } from 'lexical';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

describe('Common Plugin Tests', () => {
  let kernel: IEditor;

  beforeEach(() => {
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin]);
  });

  it('should markdown reader work', () => {
    kernel.setRootElement(document.createElement('div'));
    kernel.setDocument('markdown', 'this is <ins>underline</ins> and this is <u>underline2</u>');
    const { root } = kernel.getDocument('json') as any;

    expect(root.children.length).toBe(1);
    expect(root.children[0].type).toBe('paragraph');
    expect(root.children[0].children.length).toBe(4);

    expect(root.children[0].children[0].text).toBe('this is ');
    expect(root.children[0].children[0].format).toBe(0);

    expect(root.children[0].children[1].text).toBe('underline');
    expect(root.children[0].children[1].format & IS_UNDERLINE).toBe(IS_UNDERLINE);

    expect(root.children[0].children[2].text).toBe(' and this is ');
    expect(root.children[0].children[2].format).toBe(0);

    expect(root.children[0].children[3].text).toBe('underline2');
    expect(root.children[0].children[3].format & IS_UNDERLINE).toBe(IS_UNDERLINE);
  });

  it('should markdown html mix markdown work', () => {
    kernel.setRootElement(document.createElement('div'));
    kernel.setDocument('markdown', 'this is <ins>**strong**</ins>');
    const { root } = kernel.getDocument('json') as any;

    expect(root.children.length).toBe(1);
    expect(root.children[0].type).toBe('paragraph');
    expect(root.children[0].children.length).toBe(2);

    expect(root.children[0].children[0].text).toBe('this is ');
    expect(root.children[0].children[0].format).toBe(0);

    expect(root.children[0].children[1].text).toBe('strong');
    expect(root.children[0].children[1].format & IS_UNDERLINE).toBe(IS_UNDERLINE);
    expect(root.children[0].children[1].format & IS_BOLD).toBe(IS_BOLD);
  });
});
