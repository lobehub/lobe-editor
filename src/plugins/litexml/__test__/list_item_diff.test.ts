import { resetRandomKey } from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common/plugin';
import { ListPlugin } from '@/plugins/list/plugin';
import {
  DiffAction,
  LITEXML_DIFFNODE_ALL_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LitexmlPlugin,
} from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { IEditor } from '@/types';

describe('List item diffs', () => {
  let kernel: IEditor;

  const xml = () => kernel.getDocument('litexml') as unknown as string;
  const markdown = () => (kernel.getDocument('markdown') as unknown as string).trim();
  const json = () => JSON.stringify(kernel.getDocument('json'));
  const idOf = (tag: string, text: string) =>
    xml().match(new RegExp(`<${tag} id="([^"]+)">\\s*(?:<span[^>]*>)?${text}`))![1];

  const modify = async (operations: Parameters<IEditor['dispatchCommand']>[1]) => {
    kernel.dispatchCommand(LITEXML_MODIFY_COMMAND, operations as any);
    await moment();
  };

  const resolve = async (action: DiffAction) => {
    kernel.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action });
    await moment();
  };

  beforeEach(async () => {
    resetRandomKey();
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, ListPlugin, LitexmlPlugin]);
    kernel.initNodeEditor();
  });

  const setup = async (md: string) => {
    kernel.setDocument('markdown', md);
    await moment();
    return markdown();
  };

  it.each([DiffAction.Accept, DiffAction.Reject])(
    'keeps a modified list item reviewable until action %s',
    async (action) => {
      const before = await setup('- first\n- second\n- third');
      await modify([{ action: 'modify', litexml: `<li id="${idOf('li', 'second')}">SECOND</li>` }]);

      expect(json()).toContain('"diffType":"listItemModify"');
      expect(markdown()).toBe(before.replace('second', 'SECOND'));
      expect(xml()).toContain('SECOND');

      await resolve(action);
      expect(json()).not.toContain('"type":"diff"');
      expect(markdown()).toBe(
        action === DiffAction.Accept ? before.replace('second', 'SECOND') : before,
      );
    },
  );

  it.each([DiffAction.Accept, DiffAction.Reject])(
    'preserves nested list structure when resolving action %s',
    async (action) => {
      const before = await setup('- parent\n    - nested\n- tail');
      await modify([{ action: 'modify', litexml: `<li id="${idOf('li', 'nested')}">NESTED</li>` }]);
      await resolve(action);
      expect(markdown()).toBe(
        action === DiffAction.Accept ? before.replace('nested', 'NESTED') : before,
      );
    },
  );

  it.each(['beforeId', 'afterId'] as const)(
    'rejects a list item inserted via %s without leaving an empty bullet',
    async (anchor) => {
      const before = await setup('- first\n- second');
      const id = idOf('li', 'first');
      await modify([{ action: 'insert', [anchor]: id, litexml: '<li>added</li>' }]);

      expect(json()).toContain('"diffType":"listItemAdd"');
      expect(markdown()).toContain('- added');
      expect(xml()).toContain('added');

      await resolve(DiffAction.Reject);
      expect(markdown()).toBe(before);
    },
  );

  it.each([DiffAction.Accept, DiffAction.Reject])(
    'keeps adjacent lists separate when a whole list is replaced, action %s',
    async (action) => {
      const before = await setup('- a\n- b\n\n1. one\n2. two');
      const ulId = idOf('ul', '');
      await modify([{ action: 'modify', litexml: `<ul id="${ulId}"><li>A</li><li>B</li></ul>` }]);
      await resolve(action);
      expect(markdown()).toBe(action === DiffAction.Accept ? '- A\n- B\n\n1. one\n2. two' : before);
    },
  );

  it('restores the original list when a pending modification is removed and rejected', async () => {
    const before = await setup('intro\n\n- first\n- second\n\ntail');
    const ulId = idOf('ul', '');
    await modify([
      { action: 'modify', litexml: `<ul id="${ulId}"><li>first</li><li>SECOND</li></ul>` },
    ]);
    await modify([{ action: 'remove', id: ulId }]);
    await resolve(DiffAction.Reject);

    expect(markdown()).toBe(before);
  });
});
