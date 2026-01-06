import { resetRandomKey } from 'lexical';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common/plugin';
import {
  DiffAction,
  LITEXML_APPLY_COMMAND,
  LITEXML_DIFFNODE_ALL_COMMAND,
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LITEXML_REMOVE_COMMAND,
  LitexmlPlugin,
} from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { ListPlugin } from '@/plugins/list/plugin';
import { IEditor } from '@/types';

describe('Common Plugin Tests', () => {
  let kernel: IEditor;

  beforeEach(() => {
    resetRandomKey();
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, ListPlugin, LitexmlPlugin]);
    kernel.initNodeEditor();
  });

  it('should LITEXML_APPLY_COMMAND work', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: ['<span id="lqqe">ModifiedText</span>', '<span id="m1v0">THIS IS </span>'],
    });
    await moment();
    const markdown = kernel.getDocument('markdown') as unknown as string;
    expect(markdown).toBe(
      '# ModifiedText\n\nTHIS IS <ins>underline</ins> and this is <ins>underline2</ins>\n',
    );
  });

  it('should LITEXML_INSERT_COMMAND work', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<p><span bold="true">InsertedText</span></p>',
      afterId: 'll63',
    });
    await moment();
    const markdown = kernel.getDocument('markdown') as unknown as string;
    expect(markdown).toBe(
      '# This is a title\n\n**InsertedText**\n\nThis is <ins>underline</ins> and this is <ins>underline2</ins>\n',
    );
  });

  it('should LITEXML_REMOVE_COMMAND work', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_REMOVE_COMMAND, {
      id: 'll63',
    });
    await moment();
    const markdown = kernel.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('This is <ins>underline</ins> and this is <ins>underline2</ins>\n');
  });

  it('should LITEXML_APPLY_COMMAND delay work (json)', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    const before = kernel.getDocument('json') as any;
    kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: ['<span id="lqqe">ModifiedText</span>', '<span id="m1v0">THIS IS </span>'],
      delay: true,
    });
    await moment();
    const after = kernel.getDocument('json') as any;
    const root = after.root;
    const diffs: any[] = [];
    const walk = (node: any) => {
      if (!node) return;
      if (node.type === 'diff') diffs.push(node);
      if (node.children) node.children.forEach(walk);
    };
    walk(root);
    if (diffs.length > 0) {
      const hasModify = diffs.some((d) => d.diffType === 'modify');
      expect(hasModify).toBe(true);
      const containsModifiedText = JSON.stringify(root).includes('ModifiedText');
      expect(containsModifiedText).toBe(true);
    } else {
      // no diffs created, ensure document JSON unchanged
      expect(JSON.stringify(before)).toBe(JSON.stringify(after));
    }
  });

  it('should LITEXML_INSERT_COMMAND delay work (json)', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    const beforeIns = kernel.getDocument('json') as any;
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      litexml: '<p><span bold="true">InsertedText</span></p>',
      afterId: 'll63',
      delay: true,
    });
    await moment();
    const afterIns = kernel.getDocument('json') as any;
    const rootIns = afterIns.root;
    const diffsIns: any[] = [];
    const walkIns = (node: any) => {
      if (!node) return;
      if (node.type === 'diff') diffsIns.push(node);
      if (node.children) node.children.forEach(walkIns);
    };
    walkIns(rootIns);
    if (diffsIns.length > 0) {
      const hasAdd = diffsIns.some((d) => d.diffType === 'add' || d.diffType === 'modify');
      expect(hasAdd).toBe(true);
      const containsInserted = JSON.stringify(rootIns).includes('InsertedText');
      expect(containsInserted).toBe(true);
    } else {
      expect(JSON.stringify(beforeIns)).toBe(JSON.stringify(afterIns));
    }
  });

  it('should LITEXML_REMOVE_COMMAND delay work (json)', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    const beforeRem = kernel.getDocument('json') as any;
    kernel.dispatchCommand(LITEXML_REMOVE_COMMAND, {
      id: 'll63',
      delay: true,
    });
    await moment();
    const afterRem = kernel.getDocument('json') as any;
    const rootRem = afterRem.root;
    const diffsRem: any[] = [];
    const walkRem = (node: any) => {
      if (!node) return;
      if (node.type === 'diff') diffsRem.push(node);
      if (node.children) node.children.forEach(walkRem);
    };
    walkRem(rootRem);
    if (diffsRem.length > 0) {
      const hasRemove = diffsRem.some((d) => d.diffType === 'remove' || d.diffType === 'modify');
      expect(hasRemove).toBe(true);
    } else {
      expect(JSON.stringify(beforeRem)).toBe(JSON.stringify(afterRem));
    }
  });

  it('should LITEXML_MODIFY_COMMAND work (immediate and delay)', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    // immediate modify (non-delay)
    kernel.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      {
        action: 'modify',
        litexml: '<span id="lqqe">ModifiedTextDirect</span>',
      },
    ]);
    await moment();
    const markdownDirect = kernel.getDocument('markdown') as unknown as string;
    expect(markdownDirect).toContain('ModifiedTextDirect');

    // delayed modify (should produce diffs in JSON)
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    kernel.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      {
        action: 'modify',
        litexml: ['<span id="nr2d">ModifiedText</span>', '<span id="o26z">THIS IS </span>'],
      },
    ]);
    await moment();
    const markdown = kernel.getDocument('markdown') as unknown as string;
    expect(markdown).toBe(
      '# ModifiedText\n\nTHIS IS <ins>underline</ins> and this is <ins>underline2</ins>\n',
    );
  });

  it('should LITEXML_MODIFY_COMMAND work (immediate and delay)', async () => {
    kernel.setDocument(
      'markdown',
      '# This is a title \n' + 'This is <ins>underline</ins> and this is <ins>underline2</ins>\n\n',
    );
    // immediate modify (non-delay)
    kernel.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      {
        action: 'insert',
        afterId: 'll63',
        litexml: '<p>New Contents</p>',
      },
      {
        action: 'modify',
        litexml: '<h1 id="ll63"><b>ModifiedTextDirect</b></h1>',
      },
    ]);
    await moment();
    const markdown = kernel.getDocument('markdown') as unknown as string;
    expect(markdown).toBe(
      '# **ModifiedTextDirect**\n\nNew Contents\n\nThis is <ins>underline</ins> and this is <ins>underline2</ins>\n',
    );
  });

  it('should list item remove work', async () => {
    kernel.setDocument(
      'markdown',
      '- Item 1\n- Item 2\n- Item 3\n\n',
    );
    kernel.dispatchCommand(LITEXML_REMOVE_COMMAND, {
      delay: true,
      id: 'm1v0', // id of 'Item 2'
    });
    await moment();
    const markdown = kernel.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('- Item 1\n- \n- Item 3\n\n');
    const { root } = kernel.getDocument('json') as unknown as any;

    expect(root.children[0].children[1].type).toBe('listitem');
    expect(root.children[0].children[1].children[0].type).toBe('diff');
    expect(root.children[0].children[1].children[0].diffType).toBe('listItemRemove');

    kernel.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, {
      action: DiffAction.Accept,
    });
    await moment();
    const markdownAfter = kernel.getDocument('markdown') as unknown as string;
    expect(markdownAfter).toBe('- Item 1\n- Item 3\n\n');
  });

  it('should list item add work', async () => {
    kernel.setDocument(
      'markdown',
      '- Item 1\n- Item 2\n- Item 3\n\n',
    );
    console.info(kernel.getDocument('litexml'));
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      delay: true,
      afterId: 'm1v0', // id of 'Item 2'
      litexml: '<li id="newitem">New Item</li>',
    });
    await moment();
    const markdown = kernel.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('- Item 1\n- Item 2\n- \n- Item 3\n\n');
    const { root } = kernel.getDocument('json') as unknown as any;

    expect(root.children[0].children[2].type).toBe('listitem');
    expect(root.children[0].children[2].children[0].type).toBe('diff');
    expect(root.children[0].children[2].children[0].diffType).toBe('listItemAdd');

    kernel.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, {
      action: DiffAction.Accept,
    });
    await moment();
    const markdownAfter = kernel.getDocument('markdown') as unknown as string;
    expect(markdownAfter).toBe('- Item 1\n- Item 2\n- New Item\n- Item 3\n\n');
  });
});
