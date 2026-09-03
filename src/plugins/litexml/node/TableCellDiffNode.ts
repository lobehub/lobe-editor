import { type SerializedTableCellNode, TableCellNode } from '@lexical/table';
import type { EditorConfig, LexicalUpdateJSON, NodeKey, Spread } from 'lexical';
import { $applyNodeReplacement } from 'lexical';

import { normalizeLiteXMLChangeId } from '../change-id';
import { normalizeTableDiffWrapperIdentity } from '../table-diff-identity';

export type TableCellDiffType = 'add' | 'remove';

export type SerializedTableCellDiffNode = Spread<
  {
    changeId?: string;
    diffType: TableCellDiffType;
  },
  SerializedTableCellNode
>;

/**
 * Review-only table cell. The diff state lives on a TableCellNode subclass so
 * TableRowNode children remain cells throughout staging and approval.
 */
export class TableCellDiffNode extends TableCellNode {
  static getType(): string {
    return 'table-cell-diff';
  }

  static clone(node: TableCellDiffNode): TableCellDiffNode {
    const clone = new TableCellDiffNode(
      node.__diffType,
      node.__changeId,
      node.getHeaderStyles(),
      node.getColSpan(),
      node.getWidth(),
      node.__key,
    );
    clone.__rowSpan = node.__rowSpan;
    clone.__backgroundColor = node.__backgroundColor;
    clone.__verticalAlign = node.__verticalAlign;
    return clone;
  }

  static importJSON(serializedNode: SerializedTableCellDiffNode): TableCellDiffNode {
    return $createTableCellDiffNode(
      serializedNode.diffType,
      serializedNode.changeId,
      serializedNode.headerState,
      serializedNode.colSpan,
      serializedNode.width,
    ).updateFromJSON(serializedNode);
  }

  private __changeId?: string;
  private __diffType: TableCellDiffType;

  constructor(
    diffType: TableCellDiffType,
    changeId?: string,
    headerState?: number,
    colSpan?: number,
    width?: number,
    key?: NodeKey,
  ) {
    super(headerState, colSpan, width, key);
    this.__diffType = diffType;
    this.__changeId = normalizeLiteXMLChangeId(changeId);
  }

  createDOM(config: EditorConfig): HTMLTableCellElement {
    const element = super.createDOM(config);
    const theme = config.theme.tableCellDiff;
    if (typeof theme === 'string' && theme) element.classList.add(theme);
    this.syncDOMState(element);
    return element;
  }

  updateDOM(prevNode: this): boolean {
    return (
      super.updateDOM(prevNode) ||
      prevNode.__diffType !== this.__diffType ||
      prevNode.__changeId !== this.__changeId
    );
  }

  exportJSON(): SerializedTableCellDiffNode {
    return {
      ...super.exportJSON(),
      changeId: this.__changeId,
      diffType: this.__diffType,
      type: TableCellDiffNode.getType(),
      version: 1,
    };
  }

  getChangeId(): string | undefined {
    return this.getLatest().__changeId;
  }

  getDiffType(): TableCellDiffType {
    return this.getLatest().__diffType;
  }

  setChangeId(changeId?: string): this {
    this.getWritable().__changeId = normalizeLiteXMLChangeId(changeId);
    return this;
  }

  setDiffType(diffType: TableCellDiffType): this {
    this.getWritable().__diffType = diffType;
    return this;
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedTableCellDiffNode>): this {
    const node = super
      .updateFromJSON(serializedNode)
      .setDiffType(serializedNode.diffType)
      .setChangeId(serializedNode.changeId);
    normalizeTableDiffWrapperIdentity(node);
    return node;
  }

  private syncDOMState(element: HTMLElement): void {
    element.contentEditable = 'false';
    element.dataset.diffType = this.__diffType;
    if (this.__changeId) element.dataset.diffChangeId = this.__changeId;
    else delete element.dataset.diffChangeId;
  }
}

export function $createTableCellDiffNode(
  diffType: TableCellDiffType,
  changeId?: string,
  headerState?: number,
  colSpan?: number,
  width?: number,
): TableCellDiffNode {
  return $applyNodeReplacement(
    new TableCellDiffNode(diffType, changeId, headerState, colSpan, width),
  );
}

export function $isTableCellDiffNode(node: unknown): node is TableCellDiffNode {
  return node instanceof TableCellDiffNode;
}
