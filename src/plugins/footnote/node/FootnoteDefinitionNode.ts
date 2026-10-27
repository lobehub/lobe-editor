import { $dfs, addClassNamesToElement } from '@lexical/utils';
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  ElementDOMSlot,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  SerializedElementNode,
  Spread,
} from 'lexical';
import { $applyNodeReplacement, $getRoot, ElementNode, setDOMUnmanaged } from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

export type SerializedFootnoteDefinitionNode = Spread<
  {
    identifier: string;
  },
  SerializedElementNode
>;

export const FOOTNOTE_LABEL_SELECTOR = '[data-footnote-label="true"]';
export const FOOTNOTE_BACK_SELECTOR = '[data-footnote-back="true"]';
export const FOOTNOTE_BACK_LINK_TEXT = '↩︎';
const CONTENT_SELECTOR = '[data-footnote-content="true"]';

export class FootnoteDefinitionNode extends ElementNode {
  __identifier: string;

  static getType(): string {
    return 'footnote-definition';
  }

  static clone(node: FootnoteDefinitionNode): FootnoteDefinitionNode {
    return new FootnoteDefinitionNode(node.__identifier, node.__key);
  }

  static importJSON(serializedNode: SerializedFootnoteDefinitionNode): FootnoteDefinitionNode {
    return $createFootnoteDefinitionNode(serializedNode.identifier).updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      li: (element) =>
        element.dataset.footnoteDefinition
          ? {
              conversion: $convertFootnoteDefinitionElement,
              priority: 1,
            }
          : null,
    };
  }

  constructor(identifier: string = '', key?: NodeKey) {
    super(key);
    this.__identifier = identifier;
  }

  createDOM(config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const element = document.createElement('div');
    addClassNamesToElement(element, config.theme.footnoteDefinition);
    element.dataset.footnoteDefinition = this.__identifier;

    const label = document.createElement('span');
    label.contentEditable = 'false';
    label.dataset.footnoteLabel = 'true';

    const content = document.createElement('div');
    content.dataset.footnoteContent = 'true';

    const back = document.createElement('button');
    back.type = 'button';
    back.contentEditable = 'false';
    back.dataset.footnoteBack = 'true';
    back.textContent = FOOTNOTE_BACK_LINK_TEXT;
    back.title = getKernelFromEditor(editor)?.t('footnote.backToReference') ?? '';

    setDOMUnmanaged(label);
    setDOMUnmanaged(back);
    element.append(label, content, back);
    return element;
  }

  updateDOM(prevNode: this, dom: HTMLElement): boolean {
    if (prevNode.__identifier !== this.__identifier) {
      dom.dataset.footnoteDefinition = this.__identifier;
    }
    return false;
  }

  getDOMSlot(element: HTMLElement): ElementDOMSlot<HTMLElement> {
    const content = element.querySelector(CONTENT_SELECTOR);
    if (content instanceof HTMLElement) {
      return super.getDOMSlot(element).withElement(content);
    }
    return super.getDOMSlot(element);
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('li');
    element.dataset.footnoteDefinition = this.getIdentifier();
    return { element };
  }

  exportJSON(): SerializedFootnoteDefinitionNode {
    return {
      ...super.exportJSON(),
      identifier: this.getIdentifier(),
    };
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedFootnoteDefinitionNode>): this {
    return super.updateFromJSON(serializedNode).setIdentifier(serializedNode.identifier || '');
  }

  getIdentifier(): string {
    return this.getLatest().__identifier;
  }

  setIdentifier(identifier: string): this {
    const writable = this.getWritable();
    writable.__identifier = identifier;
    return writable;
  }

  insertNewAfter(): null {
    return null;
  }

  collapseAtStart(): boolean {
    if (!this.isEmpty() || $isReferenced(this.getIdentifier())) return true;

    const section = this.getParent();
    const target =
      this.getPreviousSibling() ??
      this.getNextSibling() ??
      section?.getPreviousSibling() ??
      section?.getNextSibling();
    this.remove();
    if (target) target.selectEnd();
    else $getRoot().selectEnd();
    return true;
  }

  canIndent(): boolean {
    return false;
  }
}

function $isReferenced(identifier: string): boolean {
  return $dfs($getRoot()).some(
    ({ node }) =>
      node.getType() === 'footnote' &&
      (node as LexicalNode & { getIdentifier(): string }).getIdentifier() === identifier,
  );
}

export function $createFootnoteDefinitionNode(identifier: string): FootnoteDefinitionNode {
  return $applyNodeReplacement(new FootnoteDefinitionNode(identifier));
}

export function $isFootnoteDefinitionNode(
  node: LexicalNode | null | undefined,
): node is FootnoteDefinitionNode {
  return node instanceof FootnoteDefinitionNode;
}

function $convertFootnoteDefinitionElement(domNode: HTMLElement): DOMConversionOutput {
  return { node: $createFootnoteDefinitionNode(domNode.dataset.footnoteDefinition || '') };
}
