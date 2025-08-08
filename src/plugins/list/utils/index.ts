import { $createListItemNode, $createListNode, $isListNode, ListType } from '@lexical/list';
import { $filter, $getNearestBlockElementAncestorOrThrow } from '@lexical/utils';
import {
  $createRangeSelection,
  $isBlockElementNode,
  $normalizeSelection__EXPERIMENTAL,
  RangeSelection,
} from 'lexical';

import { ElementTransformer } from '@/plugins/markdown/service/shortcut';

// Amount of spaces that define indentation level
// TODO: should be an option
const LIST_INDENT_SIZE = 4;

function getIndent(whitespaces: string): number {
  const tabs = whitespaces.match(/\t/g);
  const spaces = whitespaces.match(/ /g);

  let indent = 0;

  if (tabs) {
    indent += tabs.length;
  }

  if (spaces) {
    indent += Math.floor(spaces.length / LIST_INDENT_SIZE);
  }

  return indent;
}

export const listReplace = (listType: ListType): ElementTransformer['replace'] => {
  return (parentNode, children, match, isImport) => {
    const previousNode = parentNode.getPreviousSibling();
    const nextNode = parentNode.getNextSibling();
    const listItem = $createListItemNode(listType === 'check' ? match[3] === 'x' : undefined);
    if ($isListNode(nextNode) && nextNode.getListType() === listType) {
      const firstChild = nextNode.getFirstChild();
      if (firstChild !== null) {
        firstChild.insertBefore(listItem);
      } else {
        // should never happen, but let's handle gracefully, just in case.
        nextNode.append(listItem);
      }
      parentNode.remove();
    } else if ($isListNode(previousNode) && previousNode.getListType() === listType) {
      previousNode.append(listItem);
      parentNode.remove();
    } else {
      const list = $createListNode(listType, listType === 'number' ? Number(match[2]) : undefined);
      list.append(listItem);
      parentNode.replace(list);
    }
    listItem.append(...children);
    if (!isImport) {
      listItem.select(0, 0);
    }
    const indent = getIndent(match[1]);
    if (indent) {
      listItem.setIndent(indent);
    }
  };
};

export function $indentOverTab(selection: RangeSelection): boolean {
  // const handled = new Set();
  const nodes = selection.getNodes();
  const canIndentBlockNodes = $filter(nodes, (node) => {
    if ($isBlockElementNode(node) && node.canIndent()) {
      return node;
    }
    return null;
  });
  // 1. If selection spans across canIndent block nodes: indent
  if (canIndentBlockNodes.length > 0) {
    return true;
  }
  // 2. If first (anchor/focus) is at block start: indent
  const anchor = selection.anchor;
  const focus = selection.focus;
  const first = focus.isBefore(anchor) ? focus : anchor;
  const firstNode = first.getNode();
  const firstBlock = $getNearestBlockElementAncestorOrThrow(firstNode);
  if (firstBlock.canIndent()) {
    const firstBlockKey = firstBlock.getKey();
    let selectionAtStart = $createRangeSelection();
    selectionAtStart.anchor.set(firstBlockKey, 0, 'element');
    selectionAtStart.focus.set(firstBlockKey, 0, 'element');
    selectionAtStart = $normalizeSelection__EXPERIMENTAL(selectionAtStart);
    if (selectionAtStart.anchor.is(first)) {
      return true;
    }
  }
  // 3. Else: tab
  return false;
}
