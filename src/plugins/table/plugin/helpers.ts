import type { LexicalNode } from 'lexical';

export const tableCellProcessor = (before: string, content: string, after: string) => {
  return before + content.replace(/\n+$/, '').replaceAll(/\n+/g, '<br />') + after;
};

export const isRemovedTableRowDiff = (node: LexicalNode): boolean =>
  node.getType() === 'table-row-diff' &&
  'getDiffType' in node &&
  typeof node.getDiffType === 'function' &&
  node.getDiffType() === 'remove';

export const getSelectedRange = (selectedIndexes: number[]) => {
  const sortedIndexes = [...selectedIndexes].sort((a, b) => a - b);

  return {
    end: sortedIndexes.at(-1) ?? 0,
    start: sortedIndexes[0] ?? 0,
  };
};
