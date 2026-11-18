import { $isHeadingNode } from '@lexical/rich-text';
import {
  $getNodeByKey,
  $isElementNode,
  type EditorState,
  type LexicalNode,
  type NodeKey,
} from 'lexical';

export function $hasHeadingAncestor(node: LexicalNode | null | undefined): boolean {
  for (let current = node; current; current = current.getParent()) {
    if ($isHeadingNode(current)) return true;
  }
  return false;
}

function $containsHeading(node: LexicalNode): boolean {
  if ($isHeadingNode(node)) return true;
  if (!$isElementNode(node)) return false;
  for (let child = node.getFirstChild(); child; child = child.getNextSibling()) {
    if ($containsHeading(child)) return true;
  }
  return false;
}

/** Inserted, removed, moved or reordered: a heading nested inside may not be dirty itself. */
const hasMoved = (previous: LexicalNode | undefined, next: LexicalNode | undefined) =>
  !previous ||
  !next ||
  previous.__parent !== next.__parent ||
  previous.__prev !== next.__prev ||
  previous.__next !== next.__next;

/**
 * Whether an update can have changed the document's headings: their text, order or presence.
 *
 * Only the nodes the update touched are inspected, and a subtree is walked only for nodes that
 * changed position. The root is skipped: Lexical marks it intentionally dirty on every transform
 * pass, so its flag says nothing about headings.
 */
export function hasHeadingChange(
  editorState: EditorState,
  prevEditorState: EditorState,
  dirtyElements: Map<NodeKey, boolean>,
  dirtyLeaves: Set<NodeKey>,
): boolean {
  if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return false;
  // setEditorState() replaces the document but only marks the root.
  if (dirtyLeaves.size === 0 && dirtyElements.size === 1 && dirtyElements.has('root')) return true;

  const keys = [...dirtyElements.keys(), ...dirtyLeaves].filter((key) => key !== 'root');
  const moved = keys.filter((key) =>
    hasMoved(prevEditorState._nodeMap.get(key), editorState._nodeMap.get(key)),
  );
  const touchesHeading = () =>
    keys.some((key) => $hasHeadingAncestor($getNodeByKey(key))) ||
    moved.some((key) => {
      const node = $getNodeByKey(key);
      return !!node && $containsHeading(node);
    });

  return editorState.read(touchesHeading) || prevEditorState.read(touchesHeading);
}
