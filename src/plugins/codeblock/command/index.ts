import { $isCodeNode, CodeNode } from '@lexical/code';
import {
  $getRoot,
  $isElementNode,
  COMMAND_PRIORITY_EDITOR,
  ElementNode,
  LexicalEditor,
  LexicalNode,
  createCommand,
} from 'lexical';

import { ShikiTokenizer } from '../plugin/CodeHighlighterShiki';

export const CustomShikiTokenizer = {
  $tokenize: ShikiTokenizer.$tokenize,
  defaultColorReplacements: ShikiTokenizer.defaultColorReplacements,
  defaultLanguage: ShikiTokenizer.defaultLanguage,
  defaultTheme: ShikiTokenizer.defaultTheme,
};

export const UPDATE_CODEBLOCK_THEME = createCommand<{
  theme: string;
}>('UPDATE_CODEBLOCK_THEME');

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
  const unregisterThemeCommand = editor.registerCommand(
    UPDATE_CODEBLOCK_THEME,
    (payload) => {
      CustomShikiTokenizer.defaultTheme = payload.theme;
      editor.update(() => {
        const codes = getAllCodeNode($getRoot());
        codes.forEach((code) => {
          code.setTheme(payload.theme);
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
    unregisterThemeCommand();
    unregisterColorReplacementsCommand();
  };
}
