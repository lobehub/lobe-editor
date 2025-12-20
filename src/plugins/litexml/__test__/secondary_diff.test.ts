import { resetRandomKey } from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import {
  LITEXML_APPLY_COMMAND,
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LITEXML_REMOVE_COMMAND,
  LitexmlPlugin,
} from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { IEditor } from '@/types';

// Helper to find node by content in JSON tree
function findNodeByContent(node: any, content: string): any {
  if (node.text && node.text.includes(content)) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeByContent(child, content);
      if (found) return found;
    }
  }
  return null;
}

// Helper to find DiffNode containing a specific text
function findDiffNodeContaining(node: any, content: string): any {
  if (node.type === 'diff') {
    const found = findNodeByContent(node, content);
    if (found) return node;
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findDiffNodeContaining(child, content);
      if (found) return found;
    }
  }
  return null;
}

describe('Secondary Diff Tests', () => {
  let kernel: IEditor;

  beforeEach(() => {
    // reset key
    resetRandomKey();
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, LitexmlPlugin]);
    kernel.initNodeEditor();
  });

  it('should LITEXML_APPLY_COMMAND delay : Modify INSERT before BLOCK', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: ['<span id="lqqe">ModifiedText</span>', '<span id="m1v0">THIS IS </span>'],
      delay: true,
    });
    await moment();

    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      delay: true,
      beforeId: 'odbl',
      litexml: '<p><span italic="true">InsertedBeforeBlock</span></p>',
    });
    await moment();

    const json = kernel.getDocument('json') as unknown as any;
    const root = json.root;

    // 新插入的 modify 节点
    expect(root.children[0].type).toBe('diff');
    expect(root.children[0].diffType).toBe('add');
    // 第一步的 modify
    expect(root.children[1].type).toBe('diff');
    expect(root.children[1].diffType).toBe('modify');
  });

  it('should LITEXML_APPLY_COMMAND delay : Modify INSERT after BLOCK', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: ['<span id="lqqe">ModifiedText</span>', '<span id="m1v0">THIS IS </span>'],
      delay: true,
    });
    await moment();

    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      delay: true,
      afterId: 'odbl',
      litexml: '<p><span italic="true">InsertedAfterBlock</span></p>',
    });
    await moment();

    const json = kernel.getDocument('json') as unknown as any;
    const root = json.root;

    // 第一步的 modify
    expect(root.children[0].type).toBe('diff');
    expect(root.children[0].diffType).toBe('modify');
    // 新插入的 modify 节点
    expect(root.children[1].type).toBe('diff');
    expect(root.children[1].diffType).toBe('add');
  });

  it('should LITEXML_APPLY_COMMAND delay : Modify INSERT after inline', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: ['<span id="lqqe">ModifiedText</span>'],
      delay: true,
    });
    await moment();

    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      delay: true,
      afterId: 'nfxr',
      litexml: '<span italic="true">InsertedAfterBlock</span>',
    });
    await moment();

    const json = kernel.getDocument('json') as unknown as any;
    const root = json.root;

    // 第一步的 modify
    expect(root.children[0].type).toBe('diff');
    expect(root.children[0].diffType).toBe('modify');
    // 未动节点
    expect(root.children[1].type).toBe('paragraph');
  });

  it('should LITEXML_APPLY_COMMAND delay : Modify Modify inline', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: ['<span id="lqqe">ModifiedText</span>'],
      delay: true,
    });
    await moment();

    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      delay: true,
      litexml: '<span id="nfxr" italic="true">Modify inline</span>',
    });
    await moment();

    const json = kernel.getDocument('json') as unknown as any;
    const root = json.root;

    // 第一步的 modify
    expect(root.children[0].type).toBe('diff');
    expect(root.children[0].diffType).toBe('modify');
    expect(root.children[0].children[0].tag).toBe('h1');
    expect(root.children[0].children[0].children[0].text).toBe('This is a title');
    expect(root.children[0].children[1].tag).toBe('h1');
    expect(root.children[0].children[1].children[0].text).toBe('Modify inline');
    // 未动节点
    expect(root.children[1].type).toBe('paragraph');
  });

  it('should LITEXML_APPLY_COMMAND delay : Modify block', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: ['<span id="lqqe">ModifiedText</span>'],
      delay: true,
    });
    await moment();

    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      delay: true,
      litexml: '<h1 id="nadg"><span italic="true">Modify block</span></h1>',
    });
    await moment();

    const json = kernel.getDocument('json') as unknown as any;
    const root = json.root;

    // 第一步的 modify
    expect(root.children[0].type).toBe('diff');
    expect(root.children[0].diffType).toBe('modify');
    expect(root.children[0].children[0].tag).toBe('h1');
    expect(root.children[0].children[0].children[0].text).toBe('This is a title');
    expect(root.children[0].children[1].tag).toBe('h1');
    expect(root.children[0].children[1].children[0].text).toBe('Modify block');
    // 未动节点
    expect(root.children[1].type).toBe('paragraph');
  });

  it('should LITEXML_APPLY_COMMAND delay : Modify remove block', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: ['<span id="lqqe">ModifiedText</span>'],
      delay: true,
    });
    await moment();

    kernel.dispatchCommand(LITEXML_REMOVE_COMMAND, {
      delay: true,
      id: 'nadg',
    });
    await moment();
    const secondLiteXML = kernel.getDocument('litexml') as unknown as string;

    const json = kernel.getDocument('json') as unknown as any;
    const root = json.root;

    // 第一步的 modify
    expect(root.children[0].tag).toBe('h1');
    expect(root.children[0].children[0].text).toBe('This is a title');
    // 未动节点
    expect(root.children[1].type).toBe('paragraph');
  });

  it('should LITEXML_INSERT_COMMAND delay : Insert INSERT BLOCK', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<h2><span id="lqqe">ModifiedText</span></h2>',
      afterId: 'll63',
      delay: true,
    });
    await moment();

    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<h3><span id="lqqe">ModifiedText</span></h3>',
      afterId: 'mo48',
      delay: true,
    });
    await moment();

    const json = kernel.getDocument('json') as unknown as any;
    const root = json.root;

    // 原始节点
    expect(root.children[0].tag).toBe('h1');
    expect(root.children[0].children[0].text).toBe('This is a title');
    // 第一步插入节点
    expect(root.children[1].type).toBe('diff');
    // 第二步插入节点
    expect(root.children[2].type).toBe('diff');
  });

  it('should LITEXML_INSERT_COMMAND delay : Insert INSERT inline', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<h2><span id="lqqe">ModifiedText</span></h2>',
      afterId: 'll63',
      delay: true,
    });
    await moment();

    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<span id="lqqe">ModifiedText</span>',
      afterId: 'mtoj',
      delay: true,
    });
    await moment();

    const json = kernel.getDocument('json') as unknown as any;
    const root = json.root;

    // 原始节点
    expect(root.children[0].tag).toBe('h1');
    expect(root.children[0].children[0].text).toBe('This is a title');
    // 第一步插入节点
    expect(root.children[1].type).toBe('diff');
    expect(root.children[1].diffType).toBe('add');
    expect(root.children[1].children[0].children[0].text).toBe('ModifiedTextModifiedText');

    expect(root.children[2].type).toBe('paragraph');
  });

  it('should LITEXML_INSERT_COMMAND delay : Insert Modify inline', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<h2><span id="lqqe">123</span></h2>',
      afterId: 'll63',
      delay: true,
    });
    await moment();

    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: '<span id="mtoj">ModifiedText</span>',
      delay: true,
    });
    await moment();

    const json = kernel.getDocument('json') as unknown as any;
    const root = json.root;

    // 原始节点
    expect(root.children[0].tag).toBe('h1');
    expect(root.children[0].children[0].text).toBe('This is a title');
    // 第一步插入节点
    expect(root.children[1].type).toBe('diff');
    expect(root.children[1].diffType).toBe('add');
    expect(root.children[1].children[0].children[0].text).toBe('ModifiedText');

    expect(root.children[2].type).toBe('paragraph');
  });

  it('should LITEXML_INSERT_COMMAND delay : Insert Modify block', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<h2><span id="lqqe">123</span></h2>',
      afterId: 'll63',
      delay: true,
    });
    await moment();

    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: '<h3 id="mo48"><span id="mtoj">ModifiedText</span></h3>',
      delay: true,
    });
    await moment();

    const json = kernel.getDocument('json') as unknown as any;
    const root = json.root;

    // 原始节点
    expect(root.children[0].tag).toBe('h1');
    expect(root.children[0].children[0].text).toBe('This is a title');
    // 第一步插入节点
    expect(root.children[1].type).toBe('diff');
    expect(root.children[1].diffType).toBe('add');
    expect(expect(root.children[1].children[0].tag).toBe('h3'));
    expect(root.children[1].children[0].children[0].text).toBe('ModifiedText');

    expect(root.children[2].type).toBe('paragraph');
  });

  it('should LITEXML_INSERT_COMMAND delay : Insert Remove block', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<h2><span id="lqqe">123</span></h2>',
      afterId: 'll63',
      delay: true,
    });
    await moment();

    kernel.dispatchCommand(LITEXML_REMOVE_COMMAND, {
      id: 'mo48',
      delay: true,
    });
    await moment();

    const json = kernel.getDocument('json') as unknown as any;
    const root = json.root;

    // 原始节点
    expect(root.children[0].tag).toBe('h1');
    expect(root.children[0].children[0].text).toBe('This is a title');

    expect(root.children[1].type).toBe('paragraph');
  });
});
