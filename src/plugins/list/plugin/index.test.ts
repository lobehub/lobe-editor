import { $createListItemNode, $createListNode } from '@lexical/list';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import { Kernel } from '@/editor-kernel/kernel';
import { CodeblockPlugin } from '@/plugins/codeblock';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';

import { ListPlugin } from './';

const codediv = '```';

describe('List Plugin', () => {
  it('indents and outdents the current list item with Tab without inserting text', () => {
    const editor = new Kernel();
    editor.registerPlugins([MarkdownPlugin, CommonPlugin, ListPlugin]);
    const root = document.createElement('div');
    const lexical = editor.setRootElement(root);
    editor.setDocument('markdown', '1. First item\n2. Second item');
    lexical.update(() => $getRoot().selectEnd(), { discrete: true });

    lexical.update(
      () => lexical.dispatchCommand(KEY_TAB_COMMAND, new KeyboardEvent('keydown', { key: 'Tab' })),
      { discrete: true },
    );
    expect(root.querySelector('ol ol li')?.textContent).toBe('Second item');

    lexical.update(
      () =>
        lexical.dispatchCommand(
          KEY_TAB_COMMAND,
          new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }),
        ),
      { discrete: true },
    );
    expect(Array.from(root.querySelectorAll('ol > li'), (item) => item.textContent)).toEqual([
      'First item',
      'Second item',
    ]);
  });

  it('exports an ordered list at its own start after plain numbered text', async () => {
    const editor = new Kernel();
    editor.registerPlugins([MarkdownPlugin, CommonPlugin, ListPlugin]);
    const root = document.createElement('div');
    const lexical = editor.setRootElement(root);
    editor.setDocument('text', '5. 先前编号\n\n7.');
    lexical.update(() => $getRoot().selectEnd(), { discrete: true });

    lexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, ' ');
    await Promise.resolve();
    await Promise.resolve();
    lexical.update(() => lexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, '另一组'), {
      discrete: true,
    });

    const markdown = String(editor.getDocument('markdown'));
    expect(markdown).toBe('5\\. 先前编号\n\n7. 另一组\n');
    editor.setDocument('markdown', markdown);
    expect(root.querySelector('p')?.textContent).toBe('5. 先前编号');
    expect(root.querySelector('ol')?.start).toBe(7);
  });

  it('keeps separate ordered lists when exporting across an empty paragraph', () => {
    const editor = new Kernel();
    editor.registerPlugins([MarkdownPlugin, CommonPlugin, ListPlugin]);
    const root = document.createElement('div');
    const lexical = editor.setRootElement(root);
    lexical.update(
      () => {
        $getRoot()
          .clear()
          .append(
            $createListNode('number', 5).append(
              $createListItemNode().append($createTextNode('First list')),
            ),
            $createParagraphNode(),
            $createListNode('number', 7).append(
              $createListItemNode().append($createTextNode('Second list')),
            ),
          );
      },
      { discrete: true },
    );

    const markdown = String(editor.getDocument('markdown'));
    editor.setDocument('markdown', markdown);
    expect(Array.from(root.querySelectorAll('ol'), (list) => list.start)).toEqual([5, 7]);
  });

  it.each([
    {
      items: ['添加渠道模型', '查看模型价格', ''],
      paragraphs: ['这里有几个问题需要解决：'],
      start: 1,
      text: '这里有几个问题需要解决：\n1. 添加渠道模型\n2. 查看模型价格\n3.',
    },
    {
      items: [''],
      paragraphs: ['5. 先前的编号'],
      start: 7,
      text: '5. 先前的编号\n7.',
    },
  ])('preserves numbering when an ordered list shortcut starts at $start', async (testCase) => {
    const editor = new Kernel();
    editor.registerPlugins([MarkdownPlugin, CommonPlugin, ListPlugin]);
    const root = document.createElement('div');
    const lexical = editor.setRootElement(root);
    editor.setDocument('text', testCase.text);
    lexical.update(() => $getRoot().selectEnd(), { discrete: true });

    lexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, ' ');
    await Promise.resolve();
    await Promise.resolve();

    const list = root.querySelector('ol');
    expect(list?.start).toBe(testCase.start);
    expect(Array.from(list?.children ?? [], (item) => item.textContent)).toEqual(testCase.items);
    expect(Array.from(root.querySelectorAll('p'), (item) => item.textContent)).toEqual(
      testCase.paragraphs,
    );
  });

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
