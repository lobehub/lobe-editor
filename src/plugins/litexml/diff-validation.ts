export interface SerializedDiffTreeNode {
  children?: SerializedDiffTreeNode[];
  diffType?: string;
  id?: string;
  side?: string;
  type?: string;
  [key: string]: unknown;
}

export interface SerializedDiffDocument {
  root: SerializedDiffTreeNode;
  [key: string]: unknown;
}

export type LiteXmlProjectionOperation =
  | { action: 'modify'; litexml: string | string[] }
  | { action: 'remove'; id: string }
  | { action: 'insert'; beforeId: string; litexml: string }
  | { action: 'insert'; afterId: string; litexml: string };

type XmlReader = (xml: string) => { root?: { children?: SerializedDiffTreeNode[] } };

const ACTIONABLE_DIFF_TYPES = new Set([
  'add',
  'remove',
  'modify',
  'listItemAdd',
  'listItemModify',
  'listItemRemove',
]);

const isActionableDiff = (node: SerializedDiffTreeNode | undefined): boolean =>
  node?.type === 'diff' && ACTIONABLE_DIFF_TYPES.has(node.diffType || '');

const isElementNode = (node: SerializedDiffTreeNode): boolean => Array.isArray(node.children);

const cloneNode = <T>(node: T): T => structuredClone(node);

export function hasActionableDiffDescendant(node: SerializedDiffTreeNode): boolean {
  return (node.children || []).some(
    (child) => isActionableDiff(child) || hasActionableDiffDescendant(child),
  );
}

/**
 * Validate the serialized public tree. Paths use serialized node ids, not
 * Lexical's private node map, so this remains stable across JSON reloads.
 */
export function collectIllegalNestedDiffPaths(root: SerializedDiffTreeNode): string[] {
  const violations: string[] = [];

  const visit = (
    node: SerializedDiffTreeNode,
    ancestors: SerializedDiffTreeNode[],
    path: string,
  ) => {
    const actionableAncestor = [...ancestors].reverse().find(isActionableDiff);
    const rowDiffAncestor = [...ancestors]
      .reverse()
      .find((ancestor) => ancestor.type === 'table-row-diff');
    const parent = ancestors.at(-1);
    const allowedCellDiffChild = parent?.type === 'table-cell-diff' && isActionableDiff(node);

    if (isActionableDiff(node) && actionableAncestor && !allowedCellDiffChild) {
      violations.push(`${path}:diff-inside-diff`);
    }

    if (rowDiffAncestor) {
      if (node.type === 'table-cell-diff') {
        violations.push(`${path}:cell-inside-row-diff`);
      } else if (isActionableDiff(node)) {
        violations.push(`${path}:diff-inside-row-diff`);
      }
    }

    if (actionableAncestor) {
      if (node.type === 'table-cell-diff') {
        violations.push(`${path}:cell-diff-inside-diff`);
      } else if (node.type === 'table-row-diff') {
        violations.push(`${path}:row-diff-inside-diff`);
      }
    }

    if (!isElementNode(node)) return;
    node.children?.forEach((child) => {
      visit(child, [...ancestors, node], `${path}/${child.id || child.type || 'node'}`);
    });
  };

  visit(root, [], root.id || root.type || 'root');
  return violations;
}

interface NodeLocation {
  ancestors: SerializedDiffTreeNode[];
  index: number;
  node: SerializedDiffTreeNode;
  parent: SerializedDiffTreeNode | null;
}

function findNodeLocation(
  root: SerializedDiffTreeNode,
  id: string,
  ancestors: SerializedDiffTreeNode[] = [],
): NodeLocation | null {
  if (root.id === id) return { ancestors, index: -1, node: root, parent: null };

  for (const [index, child] of (root.children || []).entries()) {
    if (child.id === id) {
      return { ancestors: [...ancestors, root], index, node: child, parent: root };
    }
    const nested = findNodeLocation(child, id, [...ancestors, root]);
    if (nested) return nested;
  }

  return null;
}

function replaceNode(location: NodeLocation, replacements: SerializedDiffTreeNode[]): void {
  if (!location.parent || location.index < 0) return;
  location.parent.children?.splice(location.index, 1, ...replacements);
}

function createDiff(diffType: string, children: SerializedDiffTreeNode[]): SerializedDiffTreeNode {
  return { children, diffType, type: 'diff' };
}

function createDiffContent(
  side: 'before' | 'after',
  children: SerializedDiffTreeNode[],
): SerializedDiffTreeNode {
  return { children, side, type: 'diff-content' };
}

function projectModifyTarget(root: SerializedDiffTreeNode, incoming: SerializedDiffTreeNode): void {
  if (!incoming.id) return;
  const location = findNodeLocation(root, incoming.id);
  if (!location) return;

  const target = location.node;
  const next = cloneNode(incoming);

  if (target.type === 'tablerow' && location.parent?.type === 'table') {
    replaceNode(location, [
      {
        children: cloneNode(target.children || []),
        diffType: 'remove',
        type: 'table-row-diff',
      },
      {
        children: cloneNode(next.children || []),
        diffType: 'add',
        type: 'table-row-diff',
      },
    ]);
    return;
  }

  if (target.type === 'tablecell' || target.type === 'table-cell-diff') {
    const existingDiff = (target.children || []).find((child) => child.type === 'diff');
    if (existingDiff && target.type === 'table-cell-diff') {
      existingDiff.children = cloneNode(next.children || []);
      return;
    }

    const after = existingDiff?.children?.find(
      (child) => child.type === 'diff-content' && child.side === 'after',
    );
    if (existingDiff?.diffType === 'modify' && after) {
      after.children = cloneNode(next.children || []);
      return;
    }

    target.children = [
      createDiff('modify', [
        createDiffContent('before', cloneNode(target.children || [])),
        createDiffContent('after', cloneNode(next.children || [])),
      ]),
    ];
    return;
  }

  if (location.ancestors.some(isActionableDiff)) {
    replaceNode(location, [next]);
    return;
  }

  replaceNode(location, [createDiff('modify', [cloneNode(target), next])]);
}

function projectRemoveTarget(root: SerializedDiffTreeNode, id: string): void {
  const location = findNodeLocation(root, id);
  if (!location) return;
  if (location.ancestors.some(isActionableDiff)) {
    replaceNode(location, []);
    return;
  }

  const target = location.node;
  if (target.type === 'tablecell' || target.type === 'table-cell-diff') {
    replaceNode(location, [
      {
        children: [createDiff('remove', cloneNode(target.children || []))],
        diffType: 'remove',
        type: 'table-cell-diff',
      },
    ]);
    return;
  }

  if (target.type === 'tablerow' && location.parent?.type === 'table') {
    replaceNode(location, [
      {
        children: cloneNode(target.children || []),
        diffType: 'remove',
        type: 'table-row-diff',
      },
    ]);
    return;
  }

  replaceNode(location, [createDiff('remove', [cloneNode(target)])]);
}

function projectInsert(
  root: SerializedDiffTreeNode,
  operation: Extract<LiteXmlProjectionOperation, { action: 'insert' }>,
  readXml: XmlReader,
): void {
  const referenceId = 'beforeId' in operation ? operation.beforeId : operation.afterId;
  const reference =
    referenceId === 'root' ? null : findNodeLocation(root, referenceId)?.node || null;
  const location =
    referenceId === 'root'
      ? {
          ancestors: [root],
          index: 'beforeId' in operation ? 0 : (root.children || []).length - 1,
          node: root.children?.[0] || root,
          parent: root,
        }
      : findNodeLocation(root, referenceId);
  if (!location) return;

  const incoming = (readXml(operation.litexml).root?.children || []).map(cloneNode);
  if (incoming.length === 0 || !location.parent) return;

  const insertAt = 'beforeId' in operation ? location.index : location.index + 1;
  if (incoming.every((node) => node.type === 'tablecell') && reference?.type === 'tablecell') {
    location.parent.children?.splice(
      insertAt,
      0,
      ...incoming.map((node) => ({
        children: [createDiff('add', cloneNode(node.children || []))],
        diffType: 'add',
        type: 'table-cell-diff',
      })),
    );
    return;
  }

  if (incoming.every((node) => node.type === 'tablerow') && reference?.type === 'tablerow') {
    location.parent.children?.splice(
      insertAt,
      0,
      ...incoming.map((node) => ({
        children: cloneNode(node.children || []),
        diffType: 'add',
        type: 'table-row-diff',
      })),
    );
    return;
  }

  const actionableAncestor = location.ancestors.findLast(isActionableDiff);
  const isInlineReference = ['text', 'span', 'link', 'autolink', 'linebreak'].includes(
    reference?.type || '',
  );
  const blockAncestor = [...location.ancestors]
    .reverse()
    .find((node) =>
      ['paragraph', 'heading', 'listitem', 'table', 'tablerow', 'tablecell'].includes(
        node.type || '',
      ),
    );

  if (!actionableAncestor && blockAncestor && hasActionableDiffDescendant(blockAncestor)) {
    const wrapped = createDiff('modify', [cloneNode(blockAncestor), cloneNode(blockAncestor)]);
    const blockLocation = findNodeLocation(root, blockAncestor.id || '');
    if (blockLocation) replaceNode(blockLocation, [wrapped]);
    return;
  }

  if (actionableAncestor && !isInlineReference) {
    const originLocation = actionableAncestor.id
      ? findNodeLocation(root, actionableAncestor.id)
      : null;
    if (originLocation?.parent && originLocation.index >= 0) {
      const originInsertAt =
        'beforeId' in operation ? originLocation.index : originLocation.index + 1;
      originLocation.parent.children?.splice(
        originInsertAt,
        0,
        ...incoming.map((node) => createDiff('add', [node])),
      );
      return;
    }
  }

  const inserted =
    actionableAncestor && isInlineReference
      ? incoming
      : incoming.map((node) => createDiff('add', [node]));
  location.parent.children?.splice(insertAt, 0, ...inserted);
}

/**
 * Project one operation on a cloned serialized tree. The real Lexical tree is
 * untouched; callers compare illegal paths before/after and only dispatch safe
 * operations to the live editor.
 */
export function projectLiteXmlOperation(
  document: SerializedDiffDocument,
  operation: LiteXmlProjectionOperation,
  readXml: XmlReader,
): SerializedDiffDocument {
  const projected = cloneNode(document);
  if (operation.action === 'modify') {
    const xmls = Array.isArray(operation.litexml) ? operation.litexml : [operation.litexml];
    xmls.forEach((xml) => {
      (readXml(xml).root?.children || []).forEach((child) => {
        projectModifyTarget(projected.root, child);
      });
    });
  } else if (operation.action === 'remove') {
    projectRemoveTarget(projected.root, operation.id);
  } else {
    projectInsert(projected.root, operation, readXml);
  }
  return projected;
}
