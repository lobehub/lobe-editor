import type { BaseSelection, LexicalCommand, LexicalEditor, LexicalNode, PointType } from 'lexical';
import {
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  CUT_COMMAND,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  DROP_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  INSERT_TAB_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  PASTE_COMMAND,
  REMOVE_TEXT_COMMAND,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
} from 'lexical';

import { getBlockOffset, getLinearTextLength } from '@/utils/linear-text';

import { $getStreamingGenerationRegion } from './utils';

/** Commands which can mutate text or move a block containing a stream. */
const PROTECTED_COMMANDS = [
  CONTROLLED_TEXT_INSERTION_COMMAND,
  CUT_COMMAND,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  DROP_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  INSERT_TAB_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  PASTE_COMMAND,
  REMOVE_TEXT_COMMAND,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
] as const;

const isDirectProtectedNode = (node: LexicalNode | null): boolean => {
  if (!node) return false;
  const region = $getStreamingGenerationRegion(node);
  // Block NodeState stores the region's durable offset/length. It must not
  // lock the block's human-authored prefix/suffix, unlike the generated text
  // leaves which carry no range and are protected as a whole node.
  if (region && (region.startOffset === undefined || region.length === undefined)) return true;
  return false;
};

const isProtectedDescendant = (node: LexicalNode | null): boolean => {
  if (!node) return false;
  if (isDirectProtectedNode(node)) return true;

  if ('getChildren' in node && typeof node.getChildren === 'function') {
    return node.getChildren().some((child: LexicalNode) => isProtectedDescendant(child));
  }

  return false;
};

const findProtectedBlock = (
  node: LexicalNode | null,
): { node: LexicalNode; start: number; end: number } | null => {
  let current = node;
  while (current) {
    const region = $getStreamingGenerationRegion(current);
    if (
      region &&
      region.startOffset !== undefined &&
      region.length !== undefined &&
      Number.isSafeInteger(region.startOffset) &&
      Number.isSafeInteger(region.length)
    ) {
      return {
        end: region.startOffset + Math.max(0, region.length),
        node: current,
        start: Math.max(0, region.startOffset),
      };
    }
    current = current.getParent();
  }
  return null;
};

const getSelectionPointOffset = (point: PointType, block: LexicalNode): number | null =>
  getBlockOffset(point, block);

const isPointInsideProtectedRange = (point: PointType): boolean => {
  if (isDirectProtectedNode(point.getNode())) return true;
  const protectedBlock = findProtectedBlock(point.getNode());
  if (!protectedBlock) return false;
  const offset = getBlockOffset(point, protectedBlock.node);
  return offset !== null && offset >= protectedBlock.start && offset <= protectedBlock.end;
};

const isProtectedSibling = (node: LexicalNode | null, direction: 'next' | 'previous'): boolean => {
  let current = node;
  while (current) {
    const sibling = direction === 'next' ? current.getNextSibling() : current.getPreviousSibling();
    if (sibling) {
      if (isProtectedDescendant(sibling)) return true;
      // A structural sibling can contain a protected text node. Do not scan
      // unrelated branches once a real sibling is found: deletion at a block
      // boundary only touches the closest logical sibling.
      return false;
    }
    current = current.getParent();
  }
  return false;
};

const selectionTouchesProtectedRegion = (
  selection: BaseSelection | null,
  boundaryDirection?: 'backward' | 'forward' | 'both',
): boolean => {
  if (!$isRangeSelection(selection) && !$isNodeSelection(selection)) return false;

  try {
    const nodes = selection.getNodes();
    if (nodes.some((node) => isDirectProtectedNode(node))) return true;
    if (!$isRangeSelection(selection)) return false;

    if (!selection.isCollapsed()) {
      const protectedBlocks = new Map<LexicalNode, { end: number; start: number }>();
      for (const node of nodes) {
        const protectedBlock = findProtectedBlock(node);
        if (protectedBlock) {
          protectedBlocks.set(protectedBlock.node, {
            end: protectedBlock.end,
            start: protectedBlock.start,
          });
        }
      }

      for (const [block, range] of protectedBlocks) {
        const anchorOffset = getSelectionPointOffset(selection.anchor, block);
        const focusOffset = getSelectionPointOffset(selection.focus, block);

        // Both endpoints in the marked block: intersect the exact selected
        // interval with the generation interval. Prefix/suffix-only edits in
        // the same block therefore remain editable.
        if (anchorOffset !== null && focusOffset !== null) {
          const selectionStart = Math.min(anchorOffset, focusOffset);
          const selectionEnd = Math.max(anchorOffset, focusOffset);
          if (selectionStart <= range.end && selectionEnd >= range.start) return true;
          continue;
        }

        // If one endpoint is in this block and the other is outside, the
        // selection continues to the corresponding block boundary. Use the
        // block's text length to decide whether that path crosses the region.
        const blockLength = getLinearTextLength(block);
        if (anchorOffset !== null) {
          const boundaryStart = anchorOffset;
          const boundaryEnd = blockLength;
          if (boundaryStart <= range.end && boundaryEnd >= range.start) return true;
        } else if (focusOffset !== null) {
          const boundaryStart = 0;
          const boundaryEnd = focusOffset;
          if (boundaryStart <= range.end && boundaryEnd >= range.start) return true;
        } else {
          // A middle block on a cross-block selection is wholly selected.
          return true;
        }
      }
    }
  } catch {
    return false;
  }

  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const anchorNode = selection.anchor.getNode();
  if (isPointInsideProtectedRange(selection.anchor)) return true;

  // A collapsed delete at the edge of a human-authored node would otherwise
  // consume the adjacent generated node. Guard only that edge, leaving the
  // rest of the containing block editable.
  if (
    (boundaryDirection === 'backward' || boundaryDirection === 'both') &&
    selection.anchor.offset === 0 &&
    isProtectedSibling(anchorNode, 'previous')
  )
    return true;
  if (
    (boundaryDirection === 'forward' || boundaryDirection === 'both') &&
    selection.anchor.offset >= anchorNode.getTextContentSize() &&
    isProtectedSibling(anchorNode, 'next')
  ) {
    return true;
  }

  return false;
};

const preventDefault = (payload: unknown): void => {
  if (!payload || typeof payload !== 'object') return;
  const event = payload as { preventDefault?: () => void; stopImmediatePropagation?: () => void };
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
};

export interface StreamingGenerationGuardOptions {
  enabled?: () => boolean;
}

/**
 * Prevent ordinary user commands from changing an active Agent generation
 * region. This is intentionally selection-scoped: unrelated blocks remain
 * editable. A block menu can still remove the complete parent with a direct
 * structural update; the owning stream detects that disappearance and stops
 * without resurrecting any text.
 */
export function registerStreamingGenerationRegionGuard(
  editor: LexicalEditor,
  options: StreamingGenerationGuardOptions = {},
): () => void {
  const enabled = options.enabled ?? (() => editor.isEditable());
  const unregister = PROTECTED_COMMANDS.map((command) =>
    editor.registerCommand(
      command as LexicalCommand<unknown>,
      (payload: unknown) => {
        if (!enabled()) return false;

        let blocked = false;
        const boundaryDirection =
          command === KEY_BACKSPACE_COMMAND ||
          (command === DELETE_CHARACTER_COMMAND && payload === true) ||
          (command === DELETE_WORD_COMMAND && payload === true) ||
          (command === DELETE_LINE_COMMAND && payload === true)
            ? 'backward'
            : command === KEY_DELETE_COMMAND ||
                (command === DELETE_CHARACTER_COMMAND && payload === false) ||
                (command === DELETE_WORD_COMMAND && payload === false) ||
                (command === DELETE_LINE_COMMAND && payload === false)
              ? 'forward'
              : command === REMOVE_TEXT_COMMAND || command === CUT_COMMAND
                ? 'both'
                : undefined;
        editor.getEditorState().read(() => {
          blocked = selectionTouchesProtectedRegion($getSelection(), boundaryDirection);
        });
        if (!blocked) return false;

        preventDefault(payload);
        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    ),
  );

  return () => {
    for (const dispose of unregister) dispose();
  };
}
