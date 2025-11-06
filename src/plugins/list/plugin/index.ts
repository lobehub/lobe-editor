import {
  $isListItemNode,
  $isListNode,
  ListItemNode,
  ListNode,
  registerList,
  registerListStrictIndentTransform,
} from '@lexical/list';
import { $getNearestNodeOfType } from '@lexical/utils';
import { cx } from 'antd-style';
import { $isRootNode, LexicalEditor } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { listReplace } from '../utils';
import { registerCheckList } from './checkList';
import { registerListCommands } from './registry';

const ORDERED_LIST_REGEX = /^(\s*)(\d+)\.\s/;
const UNORDERED_LIST_REGEX = /^(\s*)[*+-]\s/;
const CHECK_LIST_REGEX = /^(\s*)(?:-\s)?\s?(\[(\s|x)?])\s/i;

export interface ListPluginOptions {
  enableHotkey?: boolean;
  theme?: string;
}

export const ListPlugin: IEditorPluginConstructor<ListPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<ListPluginOptions>
{
  static pluginName = 'ListPlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config?: ListPluginOptions,
  ) {
    super();
    // Register the list nodes
    kernel.registerNodes([ListNode, ListItemNode]);
    // Register themes for list nodes
    kernel.registerThemes({
      // Define themes for list nodes here
      list: {
        checklist: 'editor_listItemCheck',
        listitem: 'editor_listItem',
        listitemChecked: 'editor_listItemChecked',
        listitemUnchecked: 'editor_listItemUnchecked',
        nested: {
          listitem: 'editor_listItemNested',
        },
        ol: cx('editor_listOrdered', config?.theme),
        olDepth: [
          'editor_listOrdered dp1',
          'editor_listOrdered dp2',
          'editor_listOrdered dp3',
          'editor_listOrdered dp4',
          'editor_listOrdered dp5',
        ],
        ul: cx('editor_listUnordered', config?.theme),
      },
    });
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerList(editor));
    this.register(registerCheckList(editor));
    this.register(registerListStrictIndentTransform(editor));
    this.register(
      registerListCommands(editor, this.kernel, {
        enableHotkey: this.config?.enableHotkey,
      }),
    );
    this.registerMarkdown();
  }

  registerMarkdown() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) {
      return;
    }
    markdownService.registerMarkdownShortCut({
      regExp: UNORDERED_LIST_REGEX,
      replace: listReplace('bullet'),
      type: 'element',
    });

    markdownService.registerMarkdownShortCut({
      regExp: ORDERED_LIST_REGEX,
      replace: listReplace('number'),
      type: 'element',
    });

    markdownService.registerMarkdownShortCut({
      regExp: CHECK_LIST_REGEX,
      replace: listReplace('check'),
      type: 'element',
    });

    markdownService.registerMarkdownWriter(ListNode.getType(), (ctx, node) => {
      if ($isListNode(node)) {
        ctx.wrap('', '\n');
      }
    });

    const getLevel = (node: ListNode | null): number => {
      if (!node) return 0;
      if ($isRootNode(node.getParent())) {
        return 0;
      }
      const parent = node.getParent();
      if (!parent) {
        return 0;
      }
      return getLevel($getNearestNodeOfType(parent, ListNode)) + 1;
    };

    markdownService.registerMarkdownWriter(ListItemNode.getType(), (ctx, node) => {
      const parent = node.getParent();
      if ($isListItemNode(node) && $isListNode(parent)) {
        if ($isListNode(node.getFirstChild())) {
          return;
        }
        const level = getLevel(parent);
        const prefix = '    '.repeat(level);
        switch (parent.getListType()) {
          case 'bullet': {
            ctx.wrap(prefix + '- ', '\n');
            break;
          }
          case 'number': {
            ctx.wrap(`${prefix}${node.getValue()}. `, '\n');
            break;
          }
          case 'check': {
            ctx.wrap(`${prefix}- [${node.getChecked() ? 'x' : ' '}] `, '\n');
            break;
          }
          default: {
            break;
          }
        }
      }
    });

    markdownService.registerMarkdownReader('list', (node, children) => {
      const isCheck =
        node.children?.[0]?.type === 'listItem' && typeof node.children?.[0]?.checked === 'boolean';
      let start = node.start || 1;
      return INodeHelper.createElementNode('list', {
        children: children.map((v) => {
          if (v.type === 'listitem') {
            // @ts-expect-error not error
            v.value = start++;
          }
          return v;
        }),
        direction: 'ltr',
        format: '',
        indent: 0,
        listType: isCheck ? 'check' : node.ordered ? 'number' : 'bullet',
        start: node.start || 1,
        tag: node.ordered ? 'ol' : 'ul',
        version: 1,
      });
    });

    markdownService.registerMarkdownReader('listItem', (node, children, index) => {
      return children.map((v) => {
        if (v.type === 'paragraph') {
          return INodeHelper.createElementNode('listitem', {
            checked: typeof node.checked === 'boolean' ? node.checked : undefined,
            // @ts-expect-error not error
            children: v.children,
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            value: index + 1,
            version: 1,
          });
        } else if (v.type === 'list') {
          return INodeHelper.createElementNode('listitem', {
            children: [v],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            value: index + 1,
            version: 1,
          });
        }
        // keep node unchanged
        return v;
      });
    });
  }
};
