import { addClassNamesToElement } from '@lexical/utils';
import type {
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  SerializedElementNode,
} from 'lexical';
import { $applyNodeReplacement, ElementNode } from 'lexical';

export type SerializedFootnoteSectionNode = SerializedElementNode;

export class FootnoteSectionNode extends ElementNode {
  static getType(): string {
    return 'footnote-section';
  }

  static clone(node: FootnoteSectionNode): FootnoteSectionNode {
    return new FootnoteSectionNode(node.__key);
  }

  static importJSON(serializedNode: SerializedFootnoteSectionNode): FootnoteSectionNode {
    return $createFootnoteSectionNode().updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      ol: (element) =>
        element.dataset.footnoteSection
          ? {
              conversion: () => ({ node: $createFootnoteSectionNode() }),
              priority: 1,
            }
          : null,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('section');
    addClassNamesToElement(element, config.theme.footnoteSection);
    element.dataset.footnoteSection = 'true';
    return element;
  }

  updateDOM(): boolean {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('ol');
    element.dataset.footnoteSection = 'true';
    return { element };
  }

  canBeEmpty(): boolean {
    return false;
  }

  canIndent(): boolean {
    return false;
  }

  isShadowRoot(): boolean {
    return true;
  }
}

export function $createFootnoteSectionNode(): FootnoteSectionNode {
  return $applyNodeReplacement(new FootnoteSectionNode());
}

export function $isFootnoteSectionNode(
  node: LexicalNode | null | undefined,
): node is FootnoteSectionNode {
  return node instanceof FootnoteSectionNode;
}
