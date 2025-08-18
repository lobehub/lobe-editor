import {
  $createListNode,
  $isListItemNode,
  $isListNode,
  ListItemNode,
  ListNode,
  registerList,
  registerListStrictIndentTransform,
} from '@lexical/list';
import { $getNearestNodeOfType } from '@lexical/utils';
import { cx } from 'antd-style';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  INDENT_CONTENT_COMMAND,
  INSERT_TAB_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_TAB_COMMAND,
  LexicalCommand,
  LexicalEditor,
  OUTDENT_CONTENT_COMMAND,
} from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { $indentOverTab, listReplace } from '../utils';

const ORDERED_LIST_REGEX = /^(\s*)(\d+)\.\s/;
const UNORDERED_LIST_REGEX = /^(\s*)[*+-]\s/;
const CHECK_LIST_REGEX = /^(\s*)(?:-\s)?\s?(\[(\s|x)?])\s/i;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ListPluginOptions {
  className?: string;
}

export const ListPlugin: IEditorPluginConstructor<ListPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<ListPluginOptions>
{
  static pluginName = 'ListPlugin';

  constructor(
    protected kernel: IEditorKernel,
    config?: ListPluginOptions,
  ) {
    super();
    // Register the list nodes
    kernel.registerNodes([ListNode, ListItemNode]);
    // Register themes for list nodes
    kernel.registerThemes({
      // Define themes for list nodes here
      list: {
        listitem: 'editor_listItem',
        nested: {
          listitem: 'editor_listItemNested',
        },
        ol: cx(config?.className, 'editor_listOrdered'),
        olDepth: [
          'editor_listOrdered dp1',
          'editor_listOrdered dp2',
          'editor_listOrdered dp3',
          'editor_listOrdered dp4',
          'editor_listOrdered dp5',
        ],
        ul: cx(config?.className, 'editor_listUnordered'),
      },
    });

    kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
      regExp: UNORDERED_LIST_REGEX,
      replace: listReplace('bullet'),
      type: 'element',
    });

    kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
      regExp: ORDERED_LIST_REGEX,
      replace: listReplace('number'),
      type: 'element',
    });

    kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
      regExp: CHECK_LIST_REGEX,
      replace: listReplace('check'),
      type: 'element',
    });

    kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(ListNode.getType(), (ctx, node) => {
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

    kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(ListItemNode.getType(), (ctx, node) => {
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
              ctx.wrap(`${prefix}[${node.getChecked() ? 'x' : ' '}] `, '\n');
              break;
            }
            default: {
              break;
            }
          }
        }
      });
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerList(editor));
    this.register(registerListStrictIndentTransform(editor));
    this.registerClears(
      editor.registerCommand<KeyboardEvent>(
        KEY_TAB_COMMAND,
        (event) => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            return false;
          }
          event.preventDefault();
          const command: LexicalCommand<void> = $indentOverTab(selection)
            ? event.shiftKey
              ? OUTDENT_CONTENT_COMMAND
              : INDENT_CONTENT_COMMAND
            : INSERT_TAB_COMMAND;
          return editor.dispatchCommand(command, undefined);
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand<KeyboardEvent>(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return false;
          }
          const anchor = selection.anchor;
          if (anchor.offset !== 0) {
            return false;
          }
          const anchorNode = anchor.getNode();
          let listItemNode: ListItemNode | undefined;
          if ($isTextNode(anchorNode)) {
            // Do not handle non-leading text nodes
            if (anchorNode.getPreviousSibling()) {
              return false;
            }
            const parent = anchorNode.getParentOrThrow();
            if (!$isListItemNode(parent)) {
              return false;
            }
            listItemNode = parent;
          }
          if (!listItemNode || !$isRootNode(listItemNode.getParent()?.getParent())) {
            return false;
          }
          const listNode = listItemNode.getParentOrThrow() as ListNode;
          queueMicrotask(() => {
            editor.update(() => {
              let newlistNode: ListNode | undefined;
              const isFirst = listItemNode.getPreviousSibling() === null;
              if (isFirst) {
                const p = listItemNode.replace($createParagraphNode(), true);
                p.select(0, 0);
                return;
              }
              let next = listItemNode.getNextSibling();
              if (next) {
                newlistNode = $createListNode(listNode.getListType(), listItemNode.getValue());
              }
              while (next && newlistNode) {
                next.remove();
                newlistNode.append(next);
                next = next.getNextSibling();
              }
              const p = listItemNode.replace($createParagraphNode(), true);
              p.remove();
              listNode.insertAfter(p);
              if (newlistNode) {
                p.insertAfter(newlistNode);
              }
              p.select(0, 0);
            });
          });
          event.stopImmediatePropagation();
          event.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }
};
