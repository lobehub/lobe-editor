import type { Klass, LexicalNode } from 'lexical';
import { $createParagraphNode, $getRoot, $isElementNode, $isParagraphNode } from 'lexical';

import { $isCursorNode } from './cursor';
import { $createHoleNode, $isHoleNode, type HoleNode } from './hole';

export type HoleNormalizationNodeConstructor = Klass<LexicalNode>;

/** A target may be declared by its Lexical constructor, serialized type, or both. */
export type HoleNormalizationTarget = HoleNormalizationNodeConstructor | string;

export type HoleNormalizationGuard = (node: LexicalNode) => boolean;

export interface HoleNormalizationRegistry {
  readonly targets: readonly HoleNormalizationTarget[];
  register: (target: HoleNormalizationTarget) => () => void;
  matches: (node: LexicalNode) => boolean;
}

export interface HoleNormalizationOptions {
  canNormalize?: HoleNormalizationGuard;
  registry: HoleNormalizationRegistry;
}

/**
 * Create an editor-scoped declaration registry. Registration is data only;
 * callers decide when to invoke wrapping or reconciliation inside an update.
 */
export const createHoleNormalizationRegistry = (
  initialTargets: readonly HoleNormalizationTarget[] = [],
): HoleNormalizationRegistry => {
  const registrations = initialTargets.map((target) => ({ target }));

  const register = (target: HoleNormalizationTarget): (() => void) => {
    const registration = { target };
    registrations.push(registration);
    return () => {
      const index = registrations.indexOf(registration);
      if (index >= 0) registrations.splice(index, 1);
    };
  };

  const matches = (node: LexicalNode): boolean => {
    if (
      $isHoleNode(node) ||
      $isCursorNode(node) ||
      node.isInline() ||
      $isHoleNode(node.getParent())
    ) {
      return false;
    }

    return registrations.some(({ target }) =>
      typeof target === 'string' ? node.getType() === target : node instanceof target,
    );
  };

  return {
    get targets() {
      return registrations.map(({ target }) => target);
    },
    register,
    matches,
  };
};

/**
 * Wrap one registered block node. This function mutates the current Lexical
 * transaction only; callers own the surrounding editor.update lifecycle.
 */
export const $wrapNodeInHole = (
  node: LexicalNode,
  options: HoleNormalizationOptions,
): HoleNode | null => {
  if (!options.registry.matches(node) || options.canNormalize?.(node) === false) return null;

  const parent = node.getParent();
  if (!parent || $isHoleNode(parent)) return null;

  const hole = $createHoleNode();
  if (!$isParagraphNode(parent)) {
    node.replace(hole);
    hole.splice(1, 0, [node]);
    return hole;
  }

  const previousSiblings = node.getPreviousSiblings();
  const nextSiblings = node.getNextSiblings();

  if (previousSiblings.length === 0) {
    parent.insertBefore(hole);
    node.remove();
    if (parent.getChildrenSize() === 0) parent.remove();
    hole.splice(1, 0, [node]);
    return hole;
  }

  if (nextSiblings.length === 0) {
    parent.insertAfter(hole);
    node.remove();
    hole.splice(1, 0, [node]);
    return hole;
  }

  const nextParagraph = $createParagraphNode();
  nextParagraph.setFormat(parent.getFormatType());
  nextParagraph.setIndent(parent.getIndent());
  nextParagraph.setDirection(parent.getDirection());
  nextParagraph.append(...nextSiblings);
  parent.insertAfter(hole);
  hole.insertAfter(nextParagraph);
  node.remove();
  hole.splice(1, 0, [node]);
  return hole;
};

/**
 * Reconcile registered targets below a Lexical root. A target whose direct
 * parent is already a Hole is left alone, while registered descendants below
 * a composite Hole payload may still receive their own boundary.
 */
export const $reconcileHoleTargets = (
  root: LexicalNode = $getRoot(),
  options: HoleNormalizationOptions,
): HoleNode[] => {
  const candidates: LexicalNode[] = [];
  const visit = (node: LexicalNode): void => {
    if (options.registry.matches(node)) candidates.push(node);
    if ($isElementNode(node)) node.getChildren().forEach(visit);
  };

  visit(root);

  return candidates.flatMap((node) => {
    if (!node.isAttached()) return [];
    const hole = $wrapNodeInHole(node, options);
    return hole ? [hole] : [];
  });
};
