import {
  $createTextNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  createCommand,
} from 'lexical';

import {
  $createLinkHighlightNode,
  $isLinkHighlightNode,
  getLinkHighlightNode,
} from '../node/link-highlight';

export const INSERT_LINK_HIGHLIGHT_COMMAND = createCommand<undefined>(
  'INSERT_LINK_HIGHLIGHT_COMMAND',
);

export function registerLinkHighlightCommand(editor: LexicalEditor) {
  return editor.registerCommand(
    INSERT_LINK_HIGHLIGHT_COMMAND,
    () => {
      editor.update(() => {
        const selection = $getSelection();
        if (!selection || !$isRangeSelection(selection)) {
          return false;
        }
        const focusNode = selection.focus.getNode();
        const anchorNode = selection.anchor.getNode();

        const linkHighlight = getLinkHighlightNode(focusNode);

        if (linkHighlight !== getLinkHighlightNode(anchorNode)) {
          return false;
        }

        if ($isLinkHighlightNode(linkHighlight)) {
          // Remove link highlight formatting
          for (const node of linkHighlight.getChildren().slice(0)) {
            linkHighlight.insertBefore(node);
          }
          linkHighlight.remove();
          return true;
        }

        // Create link highlight with selected text
        const selectedText = selection.getTextContent();
        const linkHighlightNode = $createLinkHighlightNode();
        const textNode = $createTextNode(selectedText);
        linkHighlightNode.append(textNode);
        $insertNodes([linkHighlightNode]);
        linkHighlightNode.select();
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );
}
