import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor, LexicalNode, NodeSelection, RangeSelection } from 'lexical';
import {
  $createNodeSelection,
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isRootNode,
  $setSelection,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_HIGH,
  HISTORIC_TAG,
  HISTORY_MERGE_TAG,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from 'lexical';

import { ENTER_HOLE_CONTENT_COMMAND } from '../command';
import {
  $isCursorNode,
  type BoundaryCursorDirection,
  type CursorNode,
} from './cursor';
import { $isHoleNode, HoleNode } from './hole';

/**
 * Owns all editor behavior specific to Hole boundary markers.
 *
 * CursorNode remains a generic text caret. This controller is registered before
 * the generic cursor controller, so it consumes Hole events without teaching
 * the shared cursor implementation about Hole or Artifact node types.
 */
export function registerHoleNode(editor: LexicalEditor): () => void {
  let reconcileScheduled = false;

  const scheduleReconcile = () => {
    if (reconcileScheduled) return;
    reconcileScheduled = true;
    queueMicrotask(() => {
      reconcileScheduled = false;
      reconcileHoleNodes(editor);
    });
  };

  return mergeRegister(
    editor.registerNodeTransform(HoleNode, $normalizeHoleNode),
    editor.registerUpdateListener(() => handleHoleCursorInput(editor)),
    editor.registerCommand(
      KEY_ARROW_LEFT_COMMAND,
      (event) => handleHoleArrow(editor, event, 'left'),
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      KEY_ARROW_RIGHT_COMMAND,
      (event) => handleHoleArrow(editor, event, 'right'),
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => handleHoleBackspace(editor, event),
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      KEY_DELETE_COMMAND,
      (event) => handleHoleDelete(event),
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerUpdateListener(({ tags }) => {
      if (tags.has(COLLABORATION_TAG) || tags.has(HISTORIC_TAG)) scheduleReconcile();
    }),
  );
}

/** Repair persisted/remote Hole shapes from the document-change lifecycle. */
export function reconcileHoleNodes(editor: LexicalEditor | null | undefined): void {
  if (!editor) return;

  const holeKeys = editor.getEditorState().read(() => {
    const keys: string[] = [];
    const visit = (node: LexicalNode) => {
      if (
        $isHoleNode(node) &&
        (node.getContentChildren().length === 0 || !node.hasValidBoundaryCursors())
      ) {
        keys.push(node.getKey());
      }
      if ($isElementNode(node)) node.getChildren().forEach(visit);
    };

    $getRoot().getChildren().forEach(visit);
    return keys;
  });

  if (holeKeys.length === 0) return;

  editor.update(
    () => {
      holeKeys.forEach((key) => {
        const hole = $getNodeByKey(key);
        if ($isHoleNode(hole)) $normalizeHoleNode(hole);
      });
    },
    { tag: HISTORY_MERGE_TAG },
  );
}

export function $normalizeHoleNode(node: HoleNode): void {
  if (node.getContentChildren().length === 0) {
    const selection = $getSelection();
    const selectionWasInside = Boolean(
      selection?.getNodes().some((selected) => selected.is(node) || node.isParentOf(selected)),
    );
    const previous = node.getPreviousSibling();
    const next = node.getNextSibling();
    const parent = node.getParent();
    node.remove();

    if ($isRootNode(parent) && parent.isEmpty()) {
      const paragraph = $createParagraphNode();
      parent.append(paragraph);
      if (selectionWasInside) paragraph.selectEnd();
    } else if (selectionWasInside) {
      if (next) next.selectStart();
      else previous?.selectEnd();
    }
    return;
  }

  node.normalizeBoundaryCursors();
}

function handleHoleCursorInput(editor: LexicalEditor): void {
  editor.getEditorState().read(() => {
    if (editor.isComposing() || !editor.isEditable()) return;
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

    const cursor = selection.anchor.getNode();
    if (!$isCursorNode(cursor)) return;

    const hole = cursor.getParent();
    if (!$isHoleNode(hole) || hole.getBoundaryCursorSide(cursor) === null) return;

    const text = cursor.getTextContent().replaceAll('\uFEFF', '');
    if (!text) return;

    const cursorKey = cursor.getKey();
    editor.update(
      () => {
        const current = $getNodeByKey(cursorKey);
        if (!$isCursorNode(current)) return;
        const currentHole = current.getParent();
        if (!$isHoleNode(currentHole)) return;
        const side = currentHole.getBoundaryCursorSide(current);
        if (!side) return;

        current.setTextContent('\uFEFF');
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(text));
        if (side === 'before') currentHole.insertBefore(paragraph);
        else currentHole.insertAfter(paragraph);
        paragraph.selectEnd();
      },
      { tag: HISTORY_MERGE_TAG },
    );
  });
}

function getBoundaryContext(selection: RangeSelection): {
  cursor: CursorNode;
  hole: HoleNode;
  side: 'after' | 'before';
} | null {
  if (!selection.isCollapsed()) return null;
  const cursor = selection.anchor.getNode();
  if (!$isCursorNode(cursor)) return null;
  const hole = cursor.getParent();
  if (!$isHoleNode(hole)) return null;
  const side = hole.getBoundaryCursorSide(cursor);
  return side ? { cursor, hole, side } : null;
}

function getSelectedHole(selection: NodeSelection): HoleNode | null {
  const nodes = selection.getNodes();
  if (nodes.length !== 1) return null;

  const selected = nodes[0];
  if ($isHoleNode(selected)) return selected;
  const parent = selected.getParent();
  if (!$isHoleNode(parent)) return null;
  return parent.getContentChildren().some((content) => content.is(selected)) ? parent : null;
}

function handleSelectedHoleArrow(
  selection: NodeSelection,
  direction: BoundaryCursorDirection,
): boolean {
  const hole = getSelectedHole(selection);
  if (!hole) return false;

  const boundary = direction === 'left' ? hole.getBeforeCursor() : hole.getAfterCursor();
  if (!boundary) return false;
  if (direction === 'left') boundary.selectEnd();
  else boundary.selectStart();
  return true;
}

function handleHoleArrow(
  editor: LexicalEditor,
  event: KeyboardEvent,
  direction: BoundaryCursorDirection,
): boolean {
  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    if (handleSelectedHoleArrow(selection, direction)) {
      event.preventDefault();
      return true;
    }
    return false;
  }

  if (!$isRangeSelection(selection)) return false;
  const context = getBoundaryContext(selection);
  if (!context || !editor.isEditable()) return false;

  const { hole, side } = context;
  const entersContent =
    (side === 'before' && direction === 'right') || (side === 'after' && direction === 'left');

  if (event.shiftKey && entersContent) {
    const content =
      side === 'before' ? hole.getContentChildren()[0] : hole.getContentChildren().at(-1);
    if ($isDecoratorNode(content)) {
      const nodeSelection = $createNodeSelection();
      nodeSelection.add(content.getKey());
      $setSelection(nodeSelection);
      event.preventDefault();
      return true;
    }
  }

  if (event.shiftKey) {
    const index = hole.getIndexWithinParent();
    const parent = hole.getParent();
    if (!parent) return false;
    const boundaryOffset = side === 'before' ? index : index + 1;
    const targetOffset =
      direction === 'left'
        ? side === 'after'
          ? index
          : Math.max(0, index - 1)
        : side === 'before'
          ? index + 1
          : Math.min(parent.getChildrenSize(), index + 2);
    selection.anchor.set(parent.getKey(), boundaryOffset, 'element');
    selection.focus.set(parent.getKey(), targetOffset, 'element');
    event.preventDefault();
    return true;
  }

  if (entersContent) {
    const content =
      side === 'before' ? hole.getContentChildren()[0] : hole.getContentChildren().at(-1);
    if (!content) return false;

    if (
      editor.dispatchCommand(ENTER_HOLE_CONTENT_COMMAND, {
        edge: side === 'before' ? 'start' : 'end',
        key: content.getKey(),
      })
    ) {
      $setSelection(null);
      event.preventDefault();
      return true;
    }

    const opposite = side === 'before' ? hole.getAfterCursor() : hole.getBeforeCursor();
    if (!opposite) return false;
    if (side === 'before') opposite.selectStart();
    else opposite.selectEnd();
    event.preventDefault();
    return true;
  }

  const adjacent = side === 'before' ? hole.getPreviousSibling() : hole.getNextSibling();
  if (adjacent) {
    if (side === 'before') adjacent.selectEnd();
    else adjacent.selectStart();
    event.preventDefault();
    return true;
  }

  const paragraph = $createParagraphNode();
  if (side === 'before') {
    hole.insertBefore(paragraph);
    paragraph.selectEnd();
  } else {
    hole.insertAfter(paragraph);
    paragraph.selectStart();
  }
  event.preventDefault();
  return true;
}

function handleHoleBackspace(editor: LexicalEditor, event: KeyboardEvent): boolean {
  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    const hole = getSelectedHole(selection);
    if (!hole) return false;
    event.preventDefault();
    removeHoleAndPlaceSelection(hole);
    return true;
  }

  if (!$isRangeSelection(selection)) return false;
  const context = getBoundaryContext(selection);
  if (!context) return false;
  event.preventDefault();

  if (context.side === 'after') {
    removeHoleAndPlaceSelection(context.hole);
    return true;
  }

  const previous = context.hole.getPreviousSibling();
  if (previous) {
    previous.selectEnd();
    queueMicrotask(() => editor.dispatchCommand(KEY_BACKSPACE_COMMAND, event));
  }
  return true;
}

function handleHoleDelete(event: KeyboardEvent): boolean {
  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    const hole = getSelectedHole(selection);
    if (!hole) return false;
    event.preventDefault();
    removeHoleAndPlaceSelection(hole);
    return true;
  }

  if (!$isRangeSelection(selection)) return false;
  const context = getBoundaryContext(selection);
  if (!context) return false;
  event.preventDefault();

  if (context.side === 'before') {
    removeHoleAndPlaceSelection(context.hole);
    return true;
  }

  const next = context.hole.getNextSibling();
  next?.selectStart();
  return true;
}

function removeHoleAndPlaceSelection(hole: HoleNode): void {
  const previous = hole.getPreviousSibling();
  const next = hole.getNextSibling();
  const parent = hole.getParent();

  if (next) next.selectStart();
  else if (previous) previous.selectEnd();
  else if (parent) {
    const paragraph = $createParagraphNode();
    parent.append(paragraph);
    paragraph.selectEnd();
  }
  hole.remove();
}
