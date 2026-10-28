import { addClassNamesToElement } from '@lexical/utils';
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import { $applyNodeReplacement, DecoratorNode } from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

export type SerializedFootnoteNode = Spread<
  {
    identifier: string;
  },
  SerializedLexicalNode
>;

export class FootnoteNode extends DecoratorNode<any> {
  __identifier: string;

  static getType(): string {
    return 'footnote';
  }

  static clone(node: FootnoteNode): FootnoteNode {
    return new FootnoteNode(node.__identifier, node.__key);
  }

  static importJSON(serializedNode: SerializedFootnoteNode): FootnoteNode {
    return $createFootnoteNode(serializedNode.identifier).updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      sup: (element) =>
        element.dataset.footnoteRef
          ? {
              conversion: $convertFootnoteElement,
              priority: 1,
            }
          : null,
    };
  }

  constructor(identifier: string = '', key?: NodeKey) {
    super(key);
    this.__identifier = identifier;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('sup');
    addClassNamesToElement(element, config.theme.footnote);
    element.dataset.footnoteRef = this.__identifier;
    return element;
  }

  updateDOM(prevNode: this, dom: HTMLElement): boolean {
    if (prevNode.__identifier !== this.__identifier) {
      dom.dataset.footnoteRef = this.__identifier;
    }
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('sup');
    element.dataset.footnoteRef = this.getIdentifier();
    element.textContent = `[${this.getIdentifier()}]`;
    return { element };
  }

  exportJSON(): SerializedFootnoteNode {
    return {
      ...super.exportJSON(),
      identifier: this.getIdentifier(),
    };
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedFootnoteNode>): this {
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

  getTextContent(): string {
    return '';
  }

  isInline(): true {
    return true;
  }

  decorate(editor: LexicalEditor): any {
    const decorator = getKernelFromEditor(editor)?.getDecorator(FootnoteNode.getType());
    if (!decorator) return null;
    if (typeof decorator === 'function') return decorator(this, editor);
    return {
      queryDOM: decorator.queryDOM,
      render: decorator.render(this, editor),
    };
  }
}

export function $createFootnoteNode(identifier: string): FootnoteNode {
  return $applyNodeReplacement(new FootnoteNode(identifier));
}

export function $isFootnoteNode(node: LexicalNode | null | undefined): node is FootnoteNode {
  return node instanceof FootnoteNode;
}

function $convertFootnoteElement(domNode: HTMLElement): DOMConversionOutput {
  return { node: $createFootnoteNode(domNode.dataset.footnoteRef || '') };
}
