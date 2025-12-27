import { $isCodeNode } from '@lexical/code';
import { $findMatchingParent } from '@lexical/utils';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { ShikiTokenizer } from '../plugin/CodeHighlighterShiki';

export const CustomShikiTokenizer = {
  $tokenize: ShikiTokenizer.$tokenize,
  $tokenizeSerialized: ShikiTokenizer.$tokenizeSerialized,
  defaultLanguage: ShikiTokenizer.defaultLanguage,
  defaultTheme: ShikiTokenizer.defaultTheme,
};

export const UPDATE_CODEBLOCK_LANG = createCommand<{
  lang: string;
}>('UPDATE_CODEBLOCK_LANG');

export function registerCodeCommand(editor: LexicalEditor) {
  const unregisterLangCommand = editor.registerCommand(
    UPDATE_CODEBLOCK_LANG,
    (payload) => {
      CustomShikiTokenizer.defaultLanguage = payload.lang;
      const codeNode = editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          if (selection.isCollapsed()) {
            const node = $findMatchingParent(selection.anchor.getNode(), $isCodeNode);
            return node;
          } else {
            const anchor = $findMatchingParent(selection.anchor.getNode(), $isCodeNode);
            const focus = $findMatchingParent(selection.focus.getNode(), $isCodeNode);
            if (anchor && focus && anchor === focus) {
              return anchor;
            }
            return null;
          }
        }
        return false;
      });
      if (!codeNode) {
        return false;
      }
      // Need to defer execution due to possible transform execution order confusion from selection changes
      queueMicrotask(() => {
        editor.update(() => {
          if ($isCodeNode(codeNode)) {
            codeNode.setLanguage(payload.lang);
          }
        });
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR, // Priority
  );

  return () => {
    unregisterLangCommand();
  };
}
