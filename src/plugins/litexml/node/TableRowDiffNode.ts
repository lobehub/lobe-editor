import { type SerializedTableRowNode, TableRowNode } from '@lexical/table';
import type { EditorConfig, LexicalUpdateJSON, NodeKey, Spread } from 'lexical';
import { $applyNodeReplacement } from 'lexical';

export type TableRowDiffType = 'add' | 'remove';

export type SerializedTableRowDiffNode = Spread<
  {
    changeId?: string;
    diffType: TableRowDiffType;
  },
  SerializedTableRowNode
>;

/**
 * A review-only table row. Keeping the diff state on a TableRowNode subclass
 * preserves Lexical's table invariant: TableNode children are always rows.
 */
export class TableRowDiffNode extends TableRowNode {
  static getType(): string {
    return 'table-row-diff';
  }

  static clone(node: TableRowDiffNode): TableRowDiffNode {
    return new TableRowDiffNode(node.__diffType, node.__changeId, node.getHeight(), node.__key);
  }

  static importJSON(serializedNode: SerializedTableRowDiffNode): TableRowDiffNode {
    return $createTableRowDiffNode(
      serializedNode.diffType,
      serializedNode.changeId,
      serializedNode.height,
    ).updateFromJSON(serializedNode);
  }

  private __changeId?: string;
  private __diffType: TableRowDiffType;

  constructor(diffType: TableRowDiffType, changeId?: string, height?: number, key?: NodeKey) {
    super(height, key);
    this.__diffType = diffType;
    this.__changeId = changeId;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    const theme = config.theme.tableRowDiff;
    if (typeof theme === 'string' && theme) element.classList.add(theme);
    this.syncDOMState(element);
    return element;
  }

  exportJSON(): SerializedTableRowDiffNode {
    return {
      ...super.exportJSON(),
      changeId: this.__changeId,
      diffType: this.__diffType,
      type: TableRowDiffNode.getType(),
      version: 1,
    };
  }

  getChangeId(): string | undefined {
    return this.getLatest().__changeId;
  }

  getDiffType(): TableRowDiffType {
    return this.getLatest().__diffType;
  }

  setChangeId(changeId?: string): this {
    this.getWritable().__changeId = changeId;
    return this;
  }

  setDiffType(diffType: TableRowDiffType): this {
    this.getWritable().__diffType = diffType;
    return this;
  }

  updateDOM(prevNode: this): boolean {
    return (
      super.updateDOM(prevNode) ||
      prevNode.__diffType !== this.__diffType ||
      prevNode.__changeId !== this.__changeId
    );
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedTableRowDiffNode>): this {
    return super
      .updateFromJSON(serializedNode)
      .setDiffType(serializedNode.diffType)
      .setChangeId(serializedNode.changeId);
  }

  private syncDOMState(element: HTMLElement): void {
    element.dataset.diffType = this.__diffType;
    if (this.__changeId) {
      element.dataset.diffChangeId = this.__changeId;
    } else {
      delete element.dataset.diffChangeId;
    }
    element.contentEditable = 'false';
  }
}

export function $createTableRowDiffNode(
  diffType: TableRowDiffType,
  changeId?: string,
  height?: number,
): TableRowDiffNode {
  return $applyNodeReplacement(new TableRowDiffNode(diffType, changeId, height));
}

export function $isTableRowDiffNode(node: unknown): node is TableRowDiffNode {
  return node instanceof TableRowDiffNode;
}
