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

function getTextContent(node: any): string {
  if (typeof node?.text === 'string') return node.text;
  return Array.isArray(node?.children) ? node.children.map(getTextContent).join('') : '';
}

describe('Secondary Diff Tests', () => {
  let kernel: IEditor;

  const xml = () => kernel.getDocument('litexml') as unknown as string;
  const idFor = (tag: string, text: string, exactText = false): string => {
    const elements = xml().matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'g'));

    for (const match of elements) {
      const content = match[2].replace(/<[^>]+>/g, '').trim();
      if (exactText ? content !== text : !content.includes(text)) continue;
      const id = /\bid="([^"]+)"/.exec(match[1])?.[1];
      if (id) return id;
    }

    throw new Error(`Could not find <${tag}> for text ${JSON.stringify(text)} in LiteXML`);
  };

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
    const titleTextId = idFor('span', 'This is a title', true);
    const bodyTextId = idFor('span', 'This is', true);
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: [
        `<span id="${titleTextId}">ModifiedText</span>`,
        `<span id="${bodyTextId}">THIS IS </span>`,
      ],
      delay: true,
    });
    await moment();
    const headingId = idFor('h1', 'ModifiedText');

    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      delay: true,
      beforeId: headingId,
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
    const titleTextId = idFor('span', 'This is a title', true);
    const bodyTextId = idFor('span', 'This is', true);
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: [
        `<span id="${titleTextId}">ModifiedText</span>`,
        `<span id="${bodyTextId}">THIS IS </span>`,
      ],
      delay: true,
    });
    await moment();
    const headingId = idFor('h1', 'ModifiedText');

    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      delay: true,
      afterId: headingId,
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
    const titleTextId = idFor('span', 'This is a title', true);
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: [`<span id="${titleTextId}">ModifiedText</span>`],
      delay: true,
    });
    await moment();
    const modifiedTextId = idFor('span', 'ModifiedText', true);

    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      delay: true,
      afterId: modifiedTextId,
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
    const titleTextId = idFor('span', 'This is a title', true);
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: [`<span id="${titleTextId}">ModifiedText</span>`],
      delay: true,
    });
    await moment();
    const modifiedTextId = idFor('span', 'ModifiedText', true);

    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      delay: true,
      litexml: `<span id="${modifiedTextId}" italic="true">Modify inline</span>`,
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
    const titleTextId = idFor('span', 'This is a title', true);
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: [`<span id="${titleTextId}">ModifiedText</span>`],
      delay: true,
    });
    await moment();
    const headingId = idFor('h1', 'ModifiedText');

    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      delay: true,
      litexml: `<h1 id="${headingId}"><span italic="true">Modify block</span></h1>`,
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
    const titleTextId = idFor('span', 'This is a title', true);
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: [`<span id="${titleTextId}">ModifiedText</span>`],
      delay: true,
    });
    await moment();
    const headingId = idFor('h1', 'ModifiedText');

    kernel.dispatchCommand(LITEXML_REMOVE_COMMAND, {
      delay: true,
      id: headingId,
    });
    await moment();

    const json = kernel.getDocument('json') as unknown as any;
    const root = json.root;

    // 第一步的 modify
    expect(root.children[0].type).toBe('diff');
    expect(root.children[0].diffType).toBe('remove');
    expect(root.children[0].children[0].tag).toBe('h1');
    expect(root.children[0].children[0].children[0].text).toBe('This is a title');
    // 未动节点
    expect(root.children[1].type).toBe('paragraph');
  });

  it('should LITEXML_INSERT_COMMAND delay : Insert INSERT BLOCK', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    const headingId = idFor('h1', 'This is a title');
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<h2><span>ModifiedText</span></h2>',
      afterId: headingId,
      delay: true,
    });
    await moment();
    const insertedHeadingId = idFor('h2', 'ModifiedText', true);

    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<h3><span>ModifiedText</span></h3>',
      afterId: insertedHeadingId,
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
    const headingId = idFor('h1', 'This is a title');
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<h2><span>ModifiedText</span></h2>',
      afterId: headingId,
      delay: true,
    });
    await moment();

    const insertedSpanId = idFor('span', 'ModifiedText', true);
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<span>ModifiedText</span>',
      afterId: insertedSpanId,
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
    expect(getTextContent(root.children[1].children[0])).toBe('ModifiedTextModifiedText');
    expect(kernel.getDocument('markdown')).toContain('ModifiedTextModifiedText');

    expect(root.children[2].type).toBe('paragraph');
  });

  it('should LITEXML_INSERT_COMMAND delay : Insert Modify inline', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    const headingId = idFor('h1', 'This is a title');
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<h2><span>123</span></h2>',
      afterId: headingId,
      delay: true,
    });
    await moment();

    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: `<span id="${idFor('span', '123', true)}">ModifiedText</span>`,
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
    const headingId = idFor('h1', 'This is a title');
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<h2><span>123</span></h2>',
      afterId: headingId,
      delay: true,
    });
    await moment();

    const insertedHeadingId = idFor('h2', '123', true);
    const insertedSpanId = idFor('span', '123', true);
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: `<h3 id="${insertedHeadingId}"><span id="${insertedSpanId}">ModifiedText</span></h3>`,
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
    const headingId = idFor('h1', 'This is a title');
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<h2><span>123</span></h2>',
      afterId: headingId,
      delay: true,
    });
    await moment();

    kernel.dispatchCommand(LITEXML_REMOVE_COMMAND, {
      id: idFor('h2', '123', true),
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
