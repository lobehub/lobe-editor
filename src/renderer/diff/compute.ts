import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';

import type { LexicalDiffCell, LexicalDiffRow } from './types';

type NodeRecord = Record<string, unknown>;

type SerializedTextNodeLike = SerializedLexicalNode & {
  style?: string;
  text: string;
  type: 'text';
};

type MarkKind = 'delete' | 'insert';
type TextDiffKind = 'delete' | 'equal' | 'insert';

interface TextDiffOp {
  kind: TextDiffKind;
  text: string;
}

interface InlineNodeDiffResult {
  changed: boolean;
  newNode: SerializedLexicalNode;
  oldNode: SerializedLexicalNode;
}

interface TextNodeDiffResult {
  changed: boolean;
  newNodes: SerializedLexicalNode[];
  oldNodes: SerializedLexicalNode[];
}

interface InlineChildrenDiffResult {
  changed: boolean;
  newChildren: SerializedLexicalNode[];
  oldChildren: SerializedLexicalNode[];
}

type AlignOp =
  | { kind: 'delete'; node: SerializedLexicalNode }
  | { kind: 'equal'; node: SerializedLexicalNode }
  | { kind: 'insert'; node: SerializedLexicalNode }
  | {
      kind: 'modify';
      newNode: SerializedLexicalNode;
      oldNode: SerializedLexicalNode;
    };

const CHAR_DIFF_MAX_MATRIX_CELLS = 50_000;

const DELETE_MARK_STYLE =
  'background-color: color-mix(in srgb, var(--ant-color-error) 18%, transparent); text-decoration: line-through;';
const INSERT_MARK_STYLE =
  'background-color: color-mix(in srgb, var(--ant-color-success) 18%, transparent);';

function getBaseNodeType(node: SerializedLexicalNode | null): string | null {
  if (!node) return null;
  const type = (node as NodeRecord).type;
  return typeof type === 'string' ? type : null;
}

function getNormalizedBlockType(node: SerializedLexicalNode | null): string | null {
  if (!node) return null;
  const record = node as NodeRecord;
  const type = getBaseNodeType(node);
  if (!type) return null;

  if (type === 'heading') return `heading:${String(record.tag || 'unknown')}`;
  if (type === 'list') return `list:${String(record.listType || 'bullet')}`;

  return type;
}

function createCell(block: SerializedLexicalNode | null): LexicalDiffCell | null {
  if (!block) return null;

  return {
    baseBlockType: getBaseNodeType(block),
    block,
    blockType: getNormalizedBlockType(block),
  };
}

function getChildren(node: SerializedLexicalNode): SerializedLexicalNode[] | null {
  const children = (node as NodeRecord).children;
  return Array.isArray(children) ? (children as SerializedLexicalNode[]) : null;
}

function nodesEqual(a: SerializedLexicalNode, b: SerializedLexicalNode): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isTextNode(node: SerializedLexicalNode): node is SerializedTextNodeLike {
  const record = node as NodeRecord;
  return record.type === 'text' && typeof record.text === 'string';
}

function appendStyle(baseStyle: unknown, extraStyle: string): string {
  const normalizedBase = typeof baseStyle === 'string' ? baseStyle.trim() : '';
  if (!normalizedBase) return extraStyle;
  return `${normalizedBase}${normalizedBase.endsWith(';') ? '' : ';'} ${extraStyle}`;
}

function cloneTextNode(
  node: SerializedTextNodeLike,
  text: string,
  markKind?: MarkKind,
): SerializedLexicalNode {
  let { style } = node;

  if (markKind === 'delete') {
    style = appendStyle(style, DELETE_MARK_STYLE);
  } else if (markKind === 'insert') {
    style = appendStyle(style, INSERT_MARK_STYLE);
  }

  return {
    ...node,
    style,
    text,
  } as SerializedLexicalNode;
}

function cloneNodeWithChildren(
  node: SerializedLexicalNode,
  children: SerializedLexicalNode[],
): SerializedLexicalNode {
  return {
    ...(node as NodeRecord),
    children,
  } as unknown as SerializedLexicalNode;
}

function decorateSubtree(node: SerializedLexicalNode, kind: MarkKind): SerializedLexicalNode {
  if (isTextNode(node)) return cloneTextNode(node, node.text, kind);

  const children = getChildren(node);
  if (!children) return node;

  return cloneNodeWithChildren(
    node,
    children.map((child) => decorateSubtree(child, kind)),
  );
}

function reverseText(value: string): string {
  return Array.from(value).reverse().join('');
}

function mergeTextOps(ops: TextDiffOp[]): TextDiffOp[] {
  const merged: TextDiffOp[] = [];

  for (const op of ops) {
    if (!op.text) continue;

    const last = merged.at(-1);
    if (last && last.kind === op.kind) {
      last.text += op.text;
      continue;
    }

    merged.push({ ...op });
  }

  return merged;
}

function diffMiddleChars(oldChars: string[], newChars: string[]): TextDiffOp[] {
  const m = oldChars.length;
  const n = newChars.length;

  if (m === 0 && n === 0) return [];
  if (m === 0) return [{ kind: 'insert', text: newChars.join('') }];
  if (n === 0) return [{ kind: 'delete', text: oldChars.join('') }];

  if (m * n > CHAR_DIFF_MAX_MATRIX_CELLS) {
    return [
      { kind: 'delete', text: oldChars.join('') },
      { kind: 'insert', text: newChars.join('') },
    ];
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from<number>({ length: n + 1 }).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldChars[i - 1] === newChars[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const reversedOps: TextDiffOp[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (oldChars[i - 1] === newChars[j - 1]) {
      const last = reversedOps.at(-1);
      if (last && last.kind === 'equal') {
        last.text += oldChars[i - 1];
      } else {
        reversedOps.push({ kind: 'equal', text: oldChars[i - 1] });
      }
      i--;
      j--;
      continue;
    }

    if (dp[i - 1][j] >= dp[i][j - 1]) {
      const last = reversedOps.at(-1);
      if (last && last.kind === 'delete') {
        last.text += oldChars[i - 1];
      } else {
        reversedOps.push({ kind: 'delete', text: oldChars[i - 1] });
      }
      i--;
    } else {
      const last = reversedOps.at(-1);
      if (last && last.kind === 'insert') {
        last.text += newChars[j - 1];
      } else {
        reversedOps.push({ kind: 'insert', text: newChars[j - 1] });
      }
      j--;
    }
  }

  while (i > 0) {
    const last = reversedOps.at(-1);
    if (last && last.kind === 'delete') {
      last.text += oldChars[i - 1];
    } else {
      reversedOps.push({ kind: 'delete', text: oldChars[i - 1] });
    }
    i--;
  }

  while (j > 0) {
    const last = reversedOps.at(-1);
    if (last && last.kind === 'insert') {
      last.text += newChars[j - 1];
    } else {
      reversedOps.push({ kind: 'insert', text: newChars[j - 1] });
    }
    j--;
  }

  return mergeTextOps(
    reversedOps.reverse().map((op) => ({ kind: op.kind, text: reverseText(op.text) })),
  );
}

function diffTextByChar(oldText: string, newText: string): TextDiffOp[] {
  const oldChars = Array.from(oldText);
  const newChars = Array.from(newText);

  let prefix = 0;
  while (
    prefix < oldChars.length &&
    prefix < newChars.length &&
    oldChars[prefix] === newChars[prefix]
  ) {
    prefix++;
  }

  let oldSuffix = oldChars.length - 1;
  let newSuffix = newChars.length - 1;

  while (
    oldSuffix >= prefix &&
    newSuffix >= prefix &&
    oldChars[oldSuffix] === newChars[newSuffix]
  ) {
    oldSuffix--;
    newSuffix--;
  }

  const ops: TextDiffOp[] = [];

  if (prefix > 0) {
    ops.push({ kind: 'equal', text: oldChars.slice(0, prefix).join('') });
  }

  ops.push(
    ...diffMiddleChars(
      oldChars.slice(prefix, oldSuffix + 1),
      newChars.slice(prefix, newSuffix + 1),
    ),
  );

  if (oldSuffix < oldChars.length - 1) {
    ops.push({ kind: 'equal', text: oldChars.slice(oldSuffix + 1).join('') });
  }

  return mergeTextOps(ops);
}

function splitTextNodeByCharDiff(
  oldNode: SerializedTextNodeLike,
  newNode: SerializedTextNodeLike,
): TextNodeDiffResult {
  const ops = diffTextByChar(oldNode.text, newNode.text);
  const oldNodes: SerializedLexicalNode[] = [];
  const newNodes: SerializedLexicalNode[] = [];
  let changed = false;

  for (const op of ops) {
    if (!op.text) continue;

    if (op.kind === 'equal') {
      oldNodes.push(cloneTextNode(oldNode, op.text));
      newNodes.push(cloneTextNode(newNode, op.text));
      continue;
    }

    changed = true;

    if (op.kind === 'delete') {
      oldNodes.push(cloneTextNode(oldNode, op.text, 'delete'));
      continue;
    }

    newNodes.push(cloneTextNode(newNode, op.text, 'insert'));
  }

  return {
    changed,
    newNodes: newNodes.length > 0 ? newNodes : [newNode],
    oldNodes: oldNodes.length > 0 ? oldNodes : [oldNode],
  };
}

function alignNodes(
  oldNodes: SerializedLexicalNode[],
  newNodes: SerializedLexicalNode[],
): AlignOp[] {
  const m = oldNodes.length;
  const n = newNodes.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from<number>({ length: n + 1 }).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const skip = Math.max(dp[i - 1][j], dp[i][j - 1]);
      const oldType = getNormalizedBlockType(oldNodes[i - 1]);
      const newType = getNormalizedBlockType(newNodes[j - 1]);

      if (oldType && oldType === newType) {
        const score = nodesEqual(oldNodes[i - 1], newNodes[j - 1]) ? 2 : 1;
        dp[i][j] = Math.max(skip, dp[i - 1][j - 1] + score);
      } else {
        dp[i][j] = skip;
      }
    }
  }

  const ops: AlignOp[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    const oldType = getNormalizedBlockType(oldNodes[i - 1]);
    const newType = getNormalizedBlockType(newNodes[j - 1]);

    if (oldType && oldType === newType) {
      const exact = nodesEqual(oldNodes[i - 1], newNodes[j - 1]);
      const score = exact ? 2 : 1;

      if (dp[i][j] === dp[i - 1][j - 1] + score) {
        ops.push(
          exact
            ? { kind: 'equal', node: oldNodes[i - 1] }
            : {
                kind: 'modify',
                newNode: newNodes[j - 1],
                oldNode: oldNodes[i - 1],
              },
        );
        i--;
        j--;
        continue;
      }
    }

    if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ kind: 'delete', node: oldNodes[i - 1] });
      i--;
    } else {
      ops.push({ kind: 'insert', node: newNodes[j - 1] });
      j--;
    }
  }

  while (i > 0) {
    ops.push({ kind: 'delete', node: oldNodes[--i] });
  }
  while (j > 0) {
    ops.push({ kind: 'insert', node: newNodes[--j] });
  }

  return ops.reverse();
}

function diffChildrenInline(
  oldChildren: SerializedLexicalNode[],
  newChildren: SerializedLexicalNode[],
): InlineChildrenDiffResult {
  const ops = alignNodes(oldChildren, newChildren);
  const nextOldChildren: SerializedLexicalNode[] = [];
  const nextNewChildren: SerializedLexicalNode[] = [];
  let changed = false;

  for (const op of ops) {
    switch (op.kind) {
      case 'equal': {
        nextOldChildren.push(op.node);
        nextNewChildren.push(op.node);
        break;
      }
      case 'delete': {
        changed = true;
        nextOldChildren.push(decorateSubtree(op.node, 'delete'));
        break;
      }
      case 'insert': {
        changed = true;
        nextNewChildren.push(decorateSubtree(op.node, 'insert'));
        break;
      }
      case 'modify': {
        changed = true;

        if (isTextNode(op.oldNode) && isTextNode(op.newNode)) {
          const textDiff = splitTextNodeByCharDiff(op.oldNode, op.newNode);
          nextOldChildren.push(...textDiff.oldNodes);
          nextNewChildren.push(...textDiff.newNodes);
          break;
        }

        // Recursive descent is intentional here: same-type element nodes diff their children.
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const nested = diffNodeInline(op.oldNode, op.newNode);
        nextOldChildren.push(nested.oldNode);
        nextNewChildren.push(nested.newNode);
        break;
      }
    }
  }

  return {
    changed,
    newChildren: nextNewChildren,
    oldChildren: nextOldChildren,
  };
}

function diffNodeInline(
  oldNode: SerializedLexicalNode,
  newNode: SerializedLexicalNode,
): InlineNodeDiffResult {
  if (nodesEqual(oldNode, newNode)) {
    return {
      changed: false,
      newNode,
      oldNode,
    };
  }

  const oldChildren = getChildren(oldNode);
  const newChildren = getChildren(newNode);

  if (!oldChildren || !newChildren) {
    return {
      changed: true,
      newNode,
      oldNode,
    };
  }

  const childDiff = diffChildrenInline(oldChildren, newChildren);
  if (!childDiff.changed) {
    return {
      changed: false,
      newNode,
      oldNode,
    };
  }

  return {
    changed: true,
    newNode: cloneNodeWithChildren(newNode, childDiff.newChildren),
    oldNode: cloneNodeWithChildren(oldNode, childDiff.oldChildren),
  };
}

function getRootChildren(state: SerializedEditorState): SerializedLexicalNode[] {
  return Array.isArray(state.root.children) ? [...state.root.children] : [];
}

export function computeLexicalDiffRows(
  oldState: SerializedEditorState,
  newState: SerializedEditorState,
): LexicalDiffRow[] {
  const ops = alignNodes(getRootChildren(oldState), getRootChildren(newState));
  const rows: LexicalDiffRow[] = [];

  let index = 0;
  while (index < ops.length) {
    const op = ops[index];

    if (op.kind === 'equal') {
      rows.push({
        kind: 'equal',
        newCell: createCell(op.node),
        oldCell: createCell(op.node),
      });
      index++;
      continue;
    }

    if (op.kind === 'modify') {
      const diffed = diffNodeInline(op.oldNode, op.newNode);
      rows.push({
        kind: 'modify',
        newCell: createCell(diffed.newNode),
        oldCell: createCell(diffed.oldNode),
      });
      index++;
      continue;
    }

    const deletes: SerializedLexicalNode[] = [];
    const inserts: SerializedLexicalNode[] = [];

    while (index < ops.length && (ops[index].kind === 'delete' || ops[index].kind === 'insert')) {
      const current = ops[index];
      if (current.kind === 'delete') {
        deletes.push(current.node);
      } else if (current.kind === 'insert') {
        inserts.push(current.node);
      }
      index++;
    }

    const maxLength = Math.max(deletes.length, inserts.length);
    for (let pairIndex = 0; pairIndex < maxLength; pairIndex++) {
      const oldBlock = deletes[pairIndex] ?? null;
      const newBlock = inserts[pairIndex] ?? null;

      if (oldBlock && newBlock) {
        rows.push({
          kind: 'modify',
          newCell: createCell(newBlock),
          oldCell: createCell(oldBlock),
        });
        continue;
      }

      if (oldBlock) {
        rows.push({
          kind: 'delete',
          newCell: null,
          oldCell: createCell(oldBlock),
        });
        continue;
      }

      rows.push({
        kind: 'insert',
        newCell: createCell(newBlock),
        oldCell: null,
      });
    }
  }

  return rows;
}
