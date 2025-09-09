import type { ElementNode } from 'lexical';
import { $getRoot, $isDecoratorNode, $isElementNode, $isParagraphNode, $isTextNode } from 'lexical';

import type { ElementTransformer } from '@/plugins/markdown/service/transformers';

export const createBlockNode = (
  createNode: (match: Array<string>, parentNode: ElementNode) => ElementNode,
): ElementTransformer['replace'] => {
  return (parentNode, children, match, isImport) => {
    const node = createNode(match, parentNode);
    node.append(...children);
    parentNode.replace(node);
    if (!isImport) {
      node.select(0, 0);
    }
  };
};

/**
 * Returns the root's text content.
 * @returns The root's text content.
 */
export function $rootTextContent(): string {
  const root = $getRoot();

  return root.getTextContent();
}

/**
 * Determines if the root has any text content and can trim any whitespace if it does.
 * @param isEditorComposing - Is the editor in composition mode due to an active Input Method Editor?
 * @param trim - Should the root text have its whitespaced trimmed? Defaults to true.
 * @returns true if text content is empty, false if there is text or isEditorComposing is true.
 */
export function $isRootTextContentEmpty(isEditorComposing: boolean, trim = true): boolean {
  if (isEditorComposing) {
    return false;
  }

  let text = $rootTextContent();

  if (trim) {
    text = text.trim();
  }

  return text === '';
}

/**
 * Determines if the input should show the placeholder. If anything is in
 * in the root the placeholder should not be shown.
 * @param isComposing - Is the editor in composition mode due to an active Input Method Editor?
 * @returns true if the input should show the placeholder, false otherwise.
 */
export function $canShowPlaceholder(isComposing: boolean): boolean {
  if (!$isRootTextContentEmpty(isComposing, false)) {
    return false;
  }

  const root = $getRoot();
  const children = root.getChildren();
  const childrenLength = children.length;

  if (childrenLength > 1) {
    return false;
  }

  for (let i = 0; i < childrenLength; i++) {
    const topBlock = children[i];

    if ($isDecoratorNode(topBlock)) {
      return false;
    }

    if ($isElementNode(topBlock)) {
      if (!$isParagraphNode(topBlock)) {
        return false;
      }

      if (topBlock.__indent !== 0) {
        return false;
      }

      const topBlockChildren = topBlock.getChildren();
      const topBlockChildrenLength = topBlockChildren.length;

      for (let s = 0; s < topBlockChildrenLength; s++) {
        const child = topBlockChildren[i];

        if (!$isTextNode(child)) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Returns a function that executes {@link $canShowPlaceholder}
 * @param isEditorComposing - Is the editor in composition mode due to an active Input Method Editor?
 * @returns A function that executes $canShowPlaceholder with arguments.
 */
export function $canShowPlaceholderCurry(isEditorComposing: boolean): () => boolean {
  return () => $canShowPlaceholder(isEditorComposing);
}
