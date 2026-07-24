import { $isAtNodeEnd, $setBlocksType } from '@lexical/selection';
import { $findMatchingParent } from '@lexical/utils';
import type { ElementNode, LexicalEditor, LexicalNode, RangeSelection, TextNode } from 'lexical';
import { $createParagraphNode, $getSelection, $isRootOrShadowRoot } from 'lexical';

export const $findTopLevelElement = (node: LexicalNode) => {
  let topLevelElement =
    node.getKey() === 'root'
      ? node
      : $findMatchingParent(node, (e) => {
          const parent = e.getParent();
          return parent !== null && $isRootOrShadowRoot(parent);
        });

  if (topLevelElement === null) {
    topLevelElement = node.getTopLevelElementOrThrow();
  }
  return topLevelElement;
};

export const formatParagraph = (editor?: LexicalEditor | null) => {
  editor?.update(() => {
    const selection = $getSelection();
    $setBlocksType(selection, () => $createParagraphNode());
  });
};

export const getSelectedNode = (selection: RangeSelection): TextNode | ElementNode => {
  const anchor = selection.anchor;
  const focus = selection.focus;
  const anchorNode = selection.anchor.getNode();
  const focusNode = selection.focus.getNode();
  if (anchorNode === focusNode) {
    return anchorNode;
  }
  const isBackward = selection.isBackward();
  if (isBackward) {
    return $isAtNodeEnd(focus) ? anchorNode : focusNode;
  } else {
    return $isAtNodeEnd(anchor) ? anchorNode : focusNode;
  }
};
