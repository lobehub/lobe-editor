import { $isCodeNode, CodeNode } from '@lexical/code';
import { $findMatchingParent } from '@lexical/utils';
import {
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  ElementNode,
  LexicalEditor,
  LexicalNode,
  createCommand,
} from 'lexical';

import { ShikiTokenizer } from '../plugin/CodeHighlighterShiki';

export const CustomShikiTokenizer = {
  $tokenize: ShikiTokenizer.$tokenize,
  $tokenizeSerialized: ShikiTokenizer.$tokenizeSerialized,
  defaultColorReplacements: ShikiTokenizer.defaultColorReplacements,
  defaultLanguage: ShikiTokenizer.defaultLanguage,
  defaultTheme: ShikiTokenizer.defaultTheme,
};

export const UPDATE_CODEBLOCK_LANG = createCommand<{
  lang: string;
}>('UPDATE_CODEBLOCK_LANG');

export const UPDATE_CODEBLOCK_COLOR_REPLACEMENTS = createCommand<{
  colorReplacements?: import('../plugin/FacadeShiki').AllColorReplacements;
}>('UPDATE_CODEBLOCK_COLOR_REPLACEMENTS');

function getAllCodeNode(rootNode: ElementNode) {
  const codeNodes: CodeNode[] = [];
  let child: LexicalNode | null = rootNode.getFirstChild();
  while (child !== null) {
    if ($isCodeNode(child)) {
      codeNodes.push(child);
    }
    if ($isElementNode(child)) {
      const subChildrenNodes = getAllCodeNode(child);
      codeNodes.push(...subChildrenNodes);
    }
    child = child.getNextSibling();
  }
  return codeNodes;
}

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

  const unregisterColorReplacementsCommand = editor.registerCommand(
    UPDATE_CODEBLOCK_COLOR_REPLACEMENTS,
    (payload) => {
      CustomShikiTokenizer.defaultColorReplacements = payload.colorReplacements;
      editor.update(() => {
        const codes = getAllCodeNode($getRoot());
        codes.forEach((code) => {
          // Mark the code node as dirty to trigger re-highlighting with new color replacements
          code.markDirty();
        });
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR, // Priority
  );

  return () => {
    unregisterLangCommand();
    unregisterColorReplacementsCommand();
  };
}
