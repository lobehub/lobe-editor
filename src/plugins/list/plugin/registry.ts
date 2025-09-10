import {
  $createListNode,
  $isListItemNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from '@lexical/list';
import { mergeRegister } from '@lexical/utils';
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

import { IEditorKernel } from '@/types';
import { HotkeyEnum } from '@/types/hotkey';

import { $indentOverTab } from '../utils';

export interface ListRegistryOptions {
  enableHotkey?: boolean;
}

export function registerListCommands(
  editor: LexicalEditor,
  kernel: IEditorKernel,
  options?: ListRegistryOptions,
) {
  const { enableHotkey = true } = options || {};

  return mergeRegister(
    // Hotkey registrations
    kernel.registerHotkey(
      HotkeyEnum.UnorderedList,
      () => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
      {
        enabled: enableHotkey,
        preventDefault: true,
        stopImmediatePropagation: true,
      },
    ),
    kernel.registerHotkey(
      HotkeyEnum.OrderedList,
      () => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
      {
        enabled: enableHotkey,
        preventDefault: true,
        stopImmediatePropagation: true,
      },
    ),

    // Tab key command for indentation
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

    // Backspace key command for list item handling
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
        if ($isListItemNode(anchorNode)) {
          listItemNode = anchorNode;
        } else if ($isTextNode(anchorNode)) {
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
            // Add null check since listItemNode might be undefined in this closure
            if (!listItemNode) return;

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
