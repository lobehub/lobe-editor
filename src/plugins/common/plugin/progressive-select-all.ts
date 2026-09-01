import {
  $computeTableMapSkipCellCheck,
  $createTableSelection,
  $isTableCellNode,
  $isTableNode,
  $isTableSelection,
} from '@lexical/table';
import type { ElementNode, LexicalEditor, LexicalNode, PointType, RangeSelection } from 'lexical';
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  SELECT_ALL_COMMAND,
} from 'lexical';

const COLLAPSIBLE_NODE_TYPE = 'collapsible';

export function registerProgressiveSelectAll(editor: LexicalEditor): () => void {
  return editor.registerCommand(
    SELECT_ALL_COMMAND,
    () => {
      const selection = $getSelection();

      if ($isTableSelection(selection)) {
        return $expandTableSelection(selection);
      }

      if (!$isRangeSelection(selection)) return false;

      const anchorCell = $findNearestNode(selection.anchor.getNode(), $isTableCellNode);
      const focusCell = $findNearestNode(selection.focus.getNode(), $isTableCellNode);
      if (anchorCell && focusCell && anchorCell.is(focusCell)) {
        const table = $findNearestNode(anchorCell, $isTableNode);
        if (table) {
          const tableSelection = $createTableSelection();
          tableSelection.set(table.getKey(), anchorCell.getKey(), anchorCell.getKey());
          $setSelection(tableSelection);
          return true;
        }
      }

      const anchorCollapsible = $findCollapsibleAncestor(selection.anchor.getNode());
      const focusCollapsible = $findCollapsibleAncestor(selection.focus.getNode());
      if (!anchorCollapsible || !focusCollapsible || !anchorCollapsible.is(focusCollapsible)) {
        return false;
      }

      if ($isEntireElementSelected(selection, anchorCollapsible)) {
        $selectDocument();
      } else {
        anchorCollapsible.select(0, anchorCollapsible.getChildrenSize());
      }
      return true;
    },
    COMMAND_PRIORITY_HIGH,
  );
}

function $expandTableSelection(selection: ReturnType<typeof $createTableSelection>): boolean {
  const table = $getNodeByKey(selection.tableKey);
  if (!$isTableNode(table)) return false;

  const cells = $getTableCells(table);
  if (!cells) return false;

  const selectedCellKeys = new Set(
    selection
      .getNodes()
      .filter($isTableCellNode)
      .map((cell) => cell.getKey()),
  );
  const isEntireTableSelected = cells.keys.every((key) => selectedCellKeys.has(key));

  if (isEntireTableSelected) {
    $selectDocument();
    return true;
  }

  const tableSelection = $createTableSelection();
  tableSelection.set(table.getKey(), cells.first.getKey(), cells.last.getKey());
  $setSelection(tableSelection);
  return true;
}

function $getTableCells(table: LexicalNode) {
  if (!$isTableNode(table)) return null;

  const [tableMap] = $computeTableMapSkipCellCheck(table, null, null);
  const entries = tableMap.flat().filter(Boolean);
  const first = entries[0]?.cell;
  const last = entries.at(-1)?.cell;
  if (!first || !last) return null;

  return {
    first,
    keys: Array.from(new Set(entries.map(({ cell }) => cell.getKey()))),
    last,
  };
}

function $findNearestNode<T extends LexicalNode>(
  node: LexicalNode,
  predicate: (candidate: LexicalNode | null | undefined) => candidate is T,
): T | null {
  let current: LexicalNode | null = node;
  while (current) {
    if (predicate(current)) return current;
    current = current.getParent();
  }
  return null;
}

function $findCollapsibleAncestor(node: LexicalNode): ElementNode | null {
  return $findNearestNode(
    node,
    (candidate): candidate is ElementNode =>
      $isElementNode(candidate) && candidate.getType() === COLLAPSIBLE_NODE_TYPE,
  );
}

function $isEntireElementSelected(selection: RangeSelection, element: ElementNode): boolean {
  const startOffset = 0;
  const endOffset = element.getChildrenSize();

  return (
    ($isPointAt(selection.anchor, element, startOffset) &&
      $isPointAt(selection.focus, element, endOffset)) ||
    ($isPointAt(selection.focus, element, startOffset) &&
      $isPointAt(selection.anchor, element, endOffset))
  );
}

function $isPointAt(point: PointType, element: ElementNode, offset: number): boolean {
  return point.key === element.getKey() && point.offset === offset && point.type === 'element';
}

function $selectDocument(): void {
  const root = $getRoot();
  root.select(0, root.getChildrenSize());
}
