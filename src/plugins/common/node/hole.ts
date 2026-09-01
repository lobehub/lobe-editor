import type {
  BaseSelection,
  DOMConversionMap,
  EditorConfig,
  ElementDOMSlot,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  SerializedElementNode,
} from 'lexical';
import {
  $applyNodeReplacement,
  $getNodeByKey,
  SKIP_SCROLL_INTO_VIEW_TAG,
} from 'lexical';

import {
  $createCursorNode,
  $isCursorNode,
  type BoundaryCursorSide,
  CardLikeElementNode,
  type CursorNode,
} from './cursor';

/**
 * A block-level boundary around content which cannot host normal text input.
 *
 * Hole children intentionally use a small, stable shape:
 *
 *     [before cursor, content..., after cursor]
 *
 * The cursor nodes are real Lexical nodes (rather than DOM-only caret shims),
 * so the boundary survives JSON/Yjs synchronization and can be selected by the
 * normal editor pipeline. Text typed into either marker is moved to a paragraph
 * immediately before or after the Hole by the Hole boundary controller.
 */
export class HoleNode extends CardLikeElementNode {
  static getType(): string {
    return 'hole';
  }

  static clone(node: HoleNode): HoleNode {
    return new HoleNode(node.__key);
  }

  static importJSON(serializedNode: SerializedHoleNode): HoleNode {
    return new HoleNode().updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return null;
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const element = document.createElement('div');
    element.dataset.hole = 'true';
    element.dataset.holeLayout = 'outside-boundary';

    // The slot keeps the wrapper itself as the stable block host while letting
    // Lexical reconcile the two cursor nodes and payload in the shared Hole
    // content. Boundary cursors are positioned outside this 100%-wide flow.
    const content = document.createElement('div');
    content.dataset.holeContent = 'true';

    const createBoundaryHitArea = (side: BoundaryCursorSide) => {
      const hitArea = document.createElement('span');
      hitArea.ariaHidden = 'true';
      hitArea.contentEditable = 'false';
      hitArea.dataset.holeCursorHit = side;
      return hitArea;
    };

    element.append(content, createBoundaryHitArea('before'), createBoundaryHitArea('after'));
    const nodeKey = this.getKey();
    element.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !_editor.isEditable()) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const hitArea = target.closest<HTMLElement>('[data-hole-cursor-hit]');
      if (!hitArea || !element.contains(hitArea)) return;

      const side = hitArea.dataset.holeCursorHit;
      if (side !== 'before' && side !== 'after') return;

      event.preventDefault();
      event.stopPropagation();
      _editor.getRootElement()?.focus({ preventScroll: true });
      _editor.update(
        () => {
          const hole = $getNodeByKey(nodeKey);
          if (!$isHoleNode(hole)) return;
          hole.normalizeBoundaryCursors();
          const cursor = side === 'before' ? hole.getBeforeCursor() : hole.getAfterCursor();
          if (side === 'before') {
            cursor?.selectEnd();
          } else {
            cursor?.selectStart();
          }
        },
        { tag: SKIP_SCROLL_INTO_VIEW_TAG },
      );
    });
    return element;
  }

  getDOMSlot(element: HTMLElement): ElementDOMSlot<HTMLElement> {
    const content = element.querySelector<HTMLElement>('[data-hole-content="true"]');
    return content ? super.getDOMSlot(element).withElement(content) : super.getDOMSlot(element);
  }

  /** Holes are block containers and should not accept text beside the wrapper. */
  canInsertTextBefore(): false {
    return false;
  }

  canInsertTextAfter(): false {
    return false;
  }

  canBeEmpty(): false {
    return false;
  }

  /** Clipboard cloning must preserve the payload and both boundary cursors. */
  extractWithChild(
    _child: LexicalNode,
    _selection: BaseSelection | null,
    _destination: 'clone' | 'html',
  ): boolean {
    return true;
  }

  /** Return the marker at the leading boundary, if the shape is valid. */
  getBeforeCursor(): CursorNode | null {
    const first = this.getFirstChild();
    return $isCursorNode(first) ? first : null;
  }

  /** Return the marker at the trailing boundary, if the shape is valid. */
  getAfterCursor(): CursorNode | null {
    const last = this.getLastChild();
    return $isCursorNode(last) ? last : null;
  }

  /** Return payload children without either boundary marker. */
  getContentChildren(): LexicalNode[] {
    return this.getChildren().filter((child) => !$isCursorNode(child));
  }

  /** Keep invisible boundary markers out of comments, search, and copy text. */
  override getTextContent(): string {
    return this.getContentChildren()
      .map((child) => child.getTextContent())
      .join('');
  }

  /**
   * Repair a legacy or partially-synchronised Hole without touching cursor
   * text. The latter is important while a user is typing: the cursor update
   * listener owns moving that text into a paragraph, so normalization must
   * only repair the child shape and never reset a live marker.
   */
  normalizeBoundaryCursors(): this {
    let before = $isCursorNode(this.getFirstChild()) ? this.getFirstChild() : null;
    if (!before) {
      before = $createCursorNode();
      this.splice(0, 0, [before]);
    }

    let after = $isCursorNode(this.getLastChild()) ? this.getLastChild() : null;
    if (!after || after === before) {
      after = $createCursorNode();
      this.append(after);
    }

    this.getChildren().forEach((child) => {
      if ($isCursorNode(child) && child !== before && child !== after) {
        child.remove();
      }
    });

    return this;
  }

  /** Whether the wrapper currently has exactly two direct boundary cursors. */
  hasValidBoundaryCursors(): boolean {
    const children = this.getChildren();
    if (children.length < 2) return false;

    const first = children[0];
    const last = children.at(-1);
    return (
      $isCursorNode(first) &&
      $isCursorNode(last) &&
      first !== last &&
      children.slice(1, -1).every((child) => !$isCursorNode(child))
    );
  }

  /** Return which boundary owns a direct child cursor. */
  override getBoundaryCursorSide(cursor: LexicalNode): BoundaryCursorSide | null {
    if (cursor === this.getBeforeCursor()) return 'before';
    if (cursor === this.getAfterCursor()) return 'after';
    return null;
  }

  exportJSON(): SerializedHoleNode {
    return {
      ...super.exportJSON(),
      type: HoleNode.getType(),
      version: 1,
    };
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedHoleNode>): this {
    return super.updateFromJSON(serializedNode);
  }
}

export type SerializedHoleNode = SerializedElementNode;
export type HoleCursorSide = BoundaryCursorSide;

/**
 * Create a Hole with its two persistent cursor markers.
 *
 * The factory accepts one or more payload nodes so the primitive can wrap a
 * single decorator (Artifact) as well as a composite block in future plugins.
 */
export function $createHoleNode(content: LexicalNode | LexicalNode[] = []): HoleNode {
  const hole = $applyNodeReplacement(new HoleNode());
  const children = Array.isArray(content) ? content : [content];
  hole.append($createCursorNode(), ...children, $createCursorNode());
  return hole;
}

export function $isHoleNode(node: LexicalNode | null | undefined): node is HoleNode {
  return node?.getType() === HoleNode.getType();
}

export function $isHoleCursor(node: LexicalNode | null | undefined): node is CursorNode {
  const parent = node?.getParent();
  return (
    node !== null &&
    node !== undefined &&
    $isHoleNode(parent) &&
    parent.getBoundaryCursorSide(node) !== null
  );
}

/** Resolve the user-facing business block represented by a runtime Hole. */
export function $resolveLogicalBlockNode(node: LexicalNode): LexicalNode {
  return $isHoleNode(node) ? (node.getContentChildren()[0] ?? node) : node;
}

/** Resolve the node that must move as one structural unit. */
export function $resolveStructuralBlockNode(node: LexicalNode): LexicalNode {
  if ($isHoleNode(node)) return node;
  const parent = node.getParent();
  return $isHoleNode(parent) && parent.getContentChildren().some((content) => content.is(node))
    ? parent
    : node;
}
