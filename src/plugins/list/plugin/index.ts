import {
  ListItemNode,
  ListNode,
  registerList,
  registerListStrictIndentTransform,
} from '@lexical/list';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  INDENT_CONTENT_COMMAND,
  INSERT_TAB_COMMAND,
  KEY_TAB_COMMAND,
  LexicalCommand,
  LexicalEditor,
  OUTDENT_CONTENT_COMMAND,
} from 'lexical';

import { IEditorPlugin } from '@/editor-kernel';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPluginConstructor } from '@/editor-kernel/types';
import { IMarkdownShortCutService } from '@/plugins/markdown';

import { $indentOverTab, listReplace } from '../utils';

const ORDERED_LIST_REGEX = /^(\s*)(\d+)\.\s/;
const UNORDERED_LIST_REGEX = /^(\s*)[*+-]\s/;
const CHECK_LIST_REGEX = /^(\s*)(?:-\s)?\s?(\[(\s|x)?])\s/i;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ListPluginOptions {}

export const ListPlugin: IEditorPluginConstructor<ListPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<ListPluginOptions>
{
  static pluginName = 'ListPlugin';

  constructor(protected kernel: IEditorKernel) {
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
        ol: 'editor_listOrdered',
        olDepth: [
          'editor_listOrdered dp1',
          'editor_listOrdered dp2',
          'editor_listOrdered dp3',
          'editor_listOrdered dp4',
          'editor_listOrdered dp5',
        ],
        ul: 'editor_listUnordered',
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
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerList(editor));
    this.register(registerListStrictIndentTransform(editor));
    this.register(
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
    );
  }
};
