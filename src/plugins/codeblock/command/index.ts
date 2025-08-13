import { $isCodeNode, CodeNode } from '@lexical/code';
import { ShikiTokenizer } from '@lexical/code-shiki';
import {
  $getRoot,
  $isElementNode,
  COMMAND_PRIORITY_EDITOR,
  ElementNode,
  LexicalEditor,
  LexicalNode,
  createCommand,
} from 'lexical';

export const CustomShikiTokenizer = {
  $tokenize: ShikiTokenizer.$tokenize,
  defaultLanguage: ShikiTokenizer.defaultLanguage,
  defaultTheme: ShikiTokenizer.defaultTheme,
};

export const UPDATE_CODEBLOCK_THEME = createCommand<{
  theme: string;
}>('UPDATE_CODEBLOCK_THEME');

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
  return editor.registerCommand(
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
}
