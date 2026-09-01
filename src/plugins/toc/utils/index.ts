import type { TocItem } from '../types';

export function buildTocTree(items: Omit<TocItem, 'children'>[]): TocItem[] {
  const roots: TocItem[] = [];
  const stack: TocItem[] = [];

  for (const item of items) {
    const current: TocItem = { ...item, children: [] };

    while (stack.length > 0 && stack.at(-1)!.depth >= current.depth) {
      stack.pop();
    }

    const parent = stack.at(-1);
    if (parent) {
      parent.children.push(current);
    } else {
      roots.push(current);
    }

    stack.push(current);
  }

  return roots;
}

export function flattenTocTree(items: TocItem[]): TocItem[] {
  const result: TocItem[] = [];
  const walk = (tocItems: TocItem[]) => {
    for (const item of tocItems) {
      result.push(item);
      walk(item.children);
    }
  };

  walk(items);

  return result;
}
