import { $isTableNode, type TableNode } from '@lexical/table';
import { $getRoot } from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { TablePlugin } from '../plugin';
import {
  type ITableControllerMenuItem,
  type ITableControllerMenuRenderContext,
  ITableControllerMenuService,
} from '../service';

const describeItem = (
  item: ITableControllerMenuItem,
  context: ITableControllerMenuRenderContext,
): string => {
  switch (item.type) {
    case 'separator': {
      return '---';
    }
    case 'label': {
      return `# ${item.label}`;
    }
    case 'segmented': {
      return `[${item.options.map((option) => `${option.label}${option.active?.(context) ? '*' : ''}`).join('|')}]`;
    }
    default: {
      const label = typeof item.label === 'function' ? item.label(context) : item.label;
      return item.danger ? `!${label}` : label;
    }
  }
};

describe('table controller menu items', () => {
  let kernel: IEditor;
  let table: TableNode;

  const items = (axis: ITableControllerMenuRenderContext['axis'], selectedIndexes: number[]) => {
    const service = kernel.requireService(ITableControllerMenuService)!;
    const context = { axis, editor: kernel.getLexicalEditor()!, node: table, selectedIndexes };
    return kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => service.getItems(context).map((item) => describeItem(item, context)));
  };

  beforeEach(() => {
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, TablePlugin]);
    kernel.initNodeEditor();
    kernel.setDocument('markdown', '| a | b | c |\n| :- | - | - |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n');
    table = kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => $getRoot().getChildren().find($isTableNode)!) as TableNode;
  });

  it('builds the grouped column menu', () => {
    expect(items('column', [0])).toEqual([
      'Insert column left',
      'Insert column right',
      '---',
      '# Align',
      '[Align left*|Align center|Align right]',
      '# Column width',
      'Auto fit',
      'Distribute evenly',
      'Sync to all columns',
      '---',
      '!Delete column',
    ]);
  });

  it('counts the selection in delete labels', () => {
    expect(items('column', [0, 1]).at(-1)).toBe('!Delete 2 columns');
    expect(items('row', [0, 1, 2]).at(-1)).toBe('!Delete 3 rows');
  });

  it('builds the row menu', () => {
    expect(items('row', [1])).toEqual([
      'Insert row above',
      'Insert row below',
      '---',
      '!Delete row',
    ]);
  });

  it('builds the whole-table menu', () => {
    expect(items('table', [])).toEqual(['Distribute evenly', '---', '!Delete table']);
  });
});
