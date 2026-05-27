import { describe, expect, it } from 'vitest';

import { Kernel } from '@/editor-kernel/kernel';
import { CodeblockPlugin } from '@/plugins/codeblock';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';

import { ListPlugin } from './';

const codediv = '```';

describe('List Plugin', () => {
  it('should keep unordered nested list inside ordered list item', () => {
    const markdown = `1. Prepare release notes
   - Collect merged pull requests
   - Review user-facing changes
     - Confirm nested list rendering
2. Update documentation
3. Publish changelog`;

    const editor = new Kernel();
    editor.registerPlugins([MarkdownPlugin, CommonPlugin, ListPlugin]);

    editor.setRootElement(document.createElement('div'));

    editor.setDocument('markdown', markdown);

    const { root } = editor.getDocument('json') as any;
    expect(root.children.length).toBe(1);
    expect(root.children[0].type).toBe('list');
    expect(root.children[0].listType).toBe('number');
    expect(root.children[0].children.length).toBe(4);
    expect(root.children[0].children[0].children.length).toBe(1);
    expect(root.children[0].children[0].value).toBe(1);
    expect(root.children[0].children[0].children[0].text).toBe('Prepare release notes');
    expect(root.children[0].children[1].value).toBe(2);
    expect(root.children[0].children[1].children[0].type).toBe('list');
    expect(root.children[0].children[1].children[0].listType).toBe('bullet');
    expect(root.children[0].children[1].children[0].children[0].children[0].text).toBe(
      'Collect merged pull requests',
    );
    expect(root.children[0].children[1].children[0].children[1].children[0].text).toBe(
      'Review user-facing changes',
    );
    expect(
      root.children[0].children[1].children[0].children[2].children[0].children[0].children[0].text,
    ).toBe('Confirm nested list rendering');
    expect(root.children[0].children[2].value).toBe(2);
    expect(root.children[0].children[2].children[0].text).toBe('Update documentation');
    expect(root.children[0].children[3].value).toBe(3);
    expect(root.children[0].children[3].children[0].text).toBe('Publish changelog');
    expect(editor.getDocument('markdown')).toBe(`1. Prepare release notes
   - Collect merged pull requests
   - Review user-facing changes
     - Confirm nested list rendering

2. Update documentation

3. Publish changelog
`);
  });

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
