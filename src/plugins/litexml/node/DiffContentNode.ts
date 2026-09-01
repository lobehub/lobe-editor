import type {
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalUpdateJSON,
  SerializedElementNode,
  Spread,
} from 'lexical';
import { $applyNodeReplacement, ElementNode } from 'lexical';

export type DiffContentSide = 'after' | 'before';

export type SerializedDiffContentNode = Spread<
  {
    side: DiffContentSide;
  },
  SerializedElementNode
>;

/** Groups one side of a modify diff so it can contain any number of block nodes. */
export class DiffContentNode extends ElementNode {
  static getType(): string {
    return 'diff-content';
  }

  static clone(node: DiffContentNode): DiffContentNode {
    return new DiffContentNode(node.__side, node.__key);
  }

  static importJSON(serializedNode: SerializedDiffContentNode): DiffContentNode {
    return $createDiffContentNode(serializedNode.side).updateFromJSON(serializedNode);
  }

  static importDOM(): null {
    return null;
  }

  private __side: DiffContentSide;

  constructor(side: DiffContentSide, key?: string) {
    super(key);
    this.__side = side;
  }

  get side(): DiffContentSide {
    return this.__side;
  }

  setSide(side: DiffContentSide): this {
    this.getWritable().__side = side;
    return this;
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedDiffContentNode>): this {
    return super.updateFromJSON(serializedNode).setSide(serializedNode.side);
  }

  exportJSON(): SerializedDiffContentNode {
    return {
      ...super.exportJSON(),
      side: this.__side,
      type: DiffContentNode.getType(),
      version: 1,
    };
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const element = document.createElement('div');
    element.dataset.diffContent = this.__side;
    return element;
  }

  updateDOM(previousNode: DiffContentNode, dom: HTMLElement): boolean {
    if (previousNode.__side !== this.__side) {
      dom.dataset.diffContent = this.__side;
    }
    return false;
  }

  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const element = document.createElement('div');
    element.dataset.diffContent = this.__side;
    return { element };
  }

  canBeEmpty(): boolean {
    return true;
  }

  isInline(): boolean {
    return false;
  }
}

export function $createDiffContentNode(side: DiffContentSide): DiffContentNode {
  return $applyNodeReplacement(new DiffContentNode(side));
}

export function $isDiffContentNode(node: unknown): node is DiffContentNode {
  return node instanceof DiffContentNode;
}
