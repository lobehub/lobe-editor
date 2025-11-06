import { describe, expect, it } from 'vitest';

import { Kernel } from '@/editor-kernel/kernel';
import { CodeblockPlugin } from '@/plugins/codeblock';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';

import { ListPlugin } from './';

const codediv = '```';

describe('List Plugin', () => {
  it('badcase: list contains codeblock', () => {
    const markdown = `-   Item 1
    ${codediv}js
    console.log('Hello, world!');
    ${codediv}
-   Item 2`;

    const editor = new Kernel();
    editor.registerPlugins([MarkdownPlugin, CommonPlugin, CodeblockPlugin, ListPlugin]);

    editor.setRootElement(document.createElement('div'));

    editor.setDocument('markdown', markdown);

    const { root } = editor.getDocument('json') as any;
    expect(root.children.length).toBe(1);
    expect(root.children[0].type).toBe('list');
    expect(root.children[0].children.length).toBe(3);
    expect(root.children[0].children[1].type).toBe('listitem');
    expect(root.children[0].children[1].children.length).toBe(1);
    expect(root.children[0].children[1].children[0].type).toBe('text');
    expect(root.children[0].children[1].children[0].text).toBe("console.log('Hello, world!');");
  });
});
