/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {
  $applyNodeReplacement,
  DOMConversionMap,
  DOMConversionOutput,
  DecoratorNode,
  LexicalNode,
  SerializedLexicalNode,
  isBlockDomNode,
  isDOMTextNode,
} from 'lexical';

export type SerializedLineBreakNode = SerializedLexicalNode;

const LexicalNodeImpl = DecoratorNode.prototype.constructor;

/** @noInheritDoc */
export class LineBreakNode extends LexicalNodeImpl {
  static getType(): string {
    return 'linebreak';
  }

  static clone(node: LineBreakNode): LineBreakNode {
    return new LineBreakNode(node.__key);
  }

  getTextContent(): '\n' {
    return '\n';
  }

  createDOM(): HTMLElement {
    return document.createElement('br');
  }

  updateDOM(): false {
    return false;
  }

  isInline(): true {
    return true;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      br: (node: Node) => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        if (isOnlyChildInBlockNode(node) || isLastChildInBlockNode(node)) {
          return null;
        }
        return {
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          conversion: $convertLineBreakElement,
          priority: 0,
        };
      },
    };
  }

  static importJSON(serializedLineBreakNode: SerializedLineBreakNode): LineBreakNode {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return $createLineBreakNode().updateFromJSON(serializedLineBreakNode);
  }
}

function $convertLineBreakElement(): DOMConversionOutput {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return { node: $createLineBreakNode() };
}

export function $createLineBreakNode(): LineBreakNode {
  return $applyNodeReplacement(new LineBreakNode());
}

export function $isLineBreakNode(node: LexicalNode | null | undefined): node is LineBreakNode {
  return node instanceof LineBreakNode;
}

function isOnlyChildInBlockNode(node: Node): boolean {
  const parentElement = node.parentElement;
  if (parentElement !== null && isBlockDomNode(parentElement)) {
    const firstChild = parentElement.firstChild!;
    if (
      firstChild === node ||
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      (firstChild.nextSibling === node && isWhitespaceDomTextNode(firstChild))
    ) {
      const lastChild = parentElement.lastChild!;
      if (
        lastChild === node ||
        (lastChild.previousSibling === node &&
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          isWhitespaceDomTextNode(lastChild))
      ) {
        return true;
      }
    }
  }
  return false;
}

function isLastChildInBlockNode(node: Node): boolean {
  const parentElement = node.parentElement;
  if (parentElement !== null && isBlockDomNode(parentElement)) {
    // check if node is first child, because only child dont count
    const firstChild = parentElement.firstChild!;
    if (
      firstChild === node ||
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      (firstChild.nextSibling === node && isWhitespaceDomTextNode(firstChild))
    ) {
      return false;
    }

    // check if its last child
    const lastChild = parentElement.lastChild!;
    if (
      lastChild === node ||
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      (lastChild.previousSibling === node && isWhitespaceDomTextNode(lastChild))
    ) {
      return true;
    }
  }
  return false;
}

function isWhitespaceDomTextNode(node: Node): boolean {
  return isDOMTextNode(node) && /^( |\t|\r?\n)+$/.test(node.textContent || '');
}
