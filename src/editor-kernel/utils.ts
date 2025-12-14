import {
  $getNodeByKey,
  EditorConfig,
  ElementNode,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  createEditor,
} from 'lexical';

import type { IEditorKernel, IServiceID } from '@/types';

// DOM
export const DOM_ELEMENT_TYPE = 1;
export const DOM_TEXT_TYPE = 3;
export const DOM_DOCUMENT_TYPE = 9;
export const DOM_DOCUMENT_FRAGMENT_TYPE = 11;

export function genServiceId<T>(name: string): IServiceID<T> {
  return { __serviceId: name } as IServiceID<T>;
}

export const noop = () => {};

export function createEmptyEditorState() {
  // Create a temporary editor to get an empty state
  const tempEditor = createEditor();
  return tempEditor.getEditorState();
}

export function assert(cond?: boolean, message?: string): asserts cond {
  if (cond) {
    return;
  }

  throw new Error(message);
}

export function getNodeKeyFromDOMNode(dom: Node, editor: LexicalEditor): NodeKey | undefined {
  const prop = `__lexicalKey_${editor._key}`;
  return (dom as Node & Record<typeof prop, NodeKey | undefined>)[prop];
}

export function $getNodeFromDOMNode(
  dom: Node,
  editor: LexicalEditor,
  editorState?: ReturnType<LexicalEditor['getEditorState']>,
): LexicalNode | null {
  const key = getNodeKeyFromDOMNode(dom, editor);
  if (key !== undefined) {
    return $getNodeByKey(key, editorState);
  }
  return null;
}

/**
 * @param x - The element being tested
 * @returns Returns true if x is a DOM Node, false otherwise.
 */
export function isDOMNode(x: unknown): x is Node {
  return typeof x === 'object' && x !== null && 'nodeType' in x && typeof x.nodeType === 'number';
}

/**
 * @param x - The element being testing
 * @returns Returns true if x is a document fragment, false otherwise.
 */
export function isDocumentFragment(x: unknown): x is DocumentFragment {
  return isDOMNode(x) && x.nodeType === DOM_DOCUMENT_FRAGMENT_TYPE;
}

export function getParentElement(node: Node): HTMLElement | null {
  const parentElement = (node as HTMLSlotElement).assignedSlot || node.parentElement;
  return isDocumentFragment(parentElement)
    ? ((parentElement as unknown as ShadowRoot).host as HTMLElement)
    : parentElement;
}

export function $getNearestNodeFromDOMNode(
  startingDOM: Node,
  editor: LexicalEditor,
  editorState?: ReturnType<LexicalEditor['getEditorState']>,
): LexicalNode | null {
  let dom: Node | null = startingDOM;
  while (dom !== null) {
    const node = $getNodeFromDOMNode(dom, editor, editorState);
    if (node !== null) {
      return node;
    }
    dom = getParentElement(dom);
  }
  return null;
}

export function getKernelFromEditor(editor: LexicalEditor): IEditorKernel {
  // @ts-expect-error __kernel is injected into the lexical editor instance
  return editor._createEditorArgs?.__kernel || editor._kernel;
}

let EditorId = 0;
export const EDITOR_THEME_KEY = '__editorId';

export function generateEditorId(): string {
  EditorId += 1;
  return `editor-${EditorId}`;
}

const EditorMap = new Map<string, IEditorKernel>();

export function registerEditorKernel(id: string, kernel: IEditorKernel): void {
  EditorMap.set(id, kernel);
}

export function unregisterEditorKernel(id: string): void {
  EditorMap.delete(id);
}

export function getKernelFromEditorConfig(config: EditorConfig): IEditorKernel | null {
  const id = config.theme[EDITOR_THEME_KEY];
  return EditorMap.get(id) || null;
}

/**
 *
 * @param nodeA
 * @param nodeB
 * @returns
 */
export function compareNodeOrder(nodeA: LexicalNode, nodeB: LexicalNode): number {
  if (nodeA === nodeB) {
    return 0;
  }
  const pathA: LexicalNode[] = [];
  const pathB: LexicalNode[] = [];
  let currentA: LexicalNode | null = nodeA;
  let currentB: LexicalNode | null = nodeB;

  while (currentA) {
    pathA.unshift(currentA);
    currentA = currentA.getParent();
  }

  while (currentB) {
    pathB.unshift(currentB);
    currentB = currentB.getParent();
  }

  const minLength = Math.min(pathA.length, pathB.length);

  for (let i = 0; i < minLength; i++) {
    if (pathA[i] !== pathB[i]) {
      const siblings = pathA[i].getParent()?.getChildren() || [];
      return siblings.indexOf(pathA[i]) - siblings.indexOf(pathB[i]);
    }
  }

  // If all nodes in the shorter path are the same, the shorter path's node comes first
  if (pathA.length !== pathB.length) {
    return pathA.length - pathB.length;
  }

  // This case should not happen as we checked for equality at the start
  return 0;
}

export function $closest(
  node: LexicalNode | ElementNode | null,
  test: (node: LexicalNode) => boolean,
): LexicalNode | null {
  let current: LexicalNode | null = node;
  while (current) {
    if (test(current)) {
      return current;
    }
    current = current.getParent();
  }
  return null;
}

export function $closestNodeType(
  node: LexicalNode | ElementNode | null,
  type: string | string[],
): LexicalNode | null {
  return $closest(node, (n) =>
    Array.isArray(type) ? type.includes(n.getType()) : n.getType() === type,
  );
}

export function moment() {
  return new Promise((resolve) => {
    queueMicrotask(() => resolve(true));
  });
}

function cloneDecorators(editor: LexicalEditor): Record<NodeKey, unknown> {
  const currentDecorators = editor._decorators;
  const pendingDecorators = Object.assign({}, currentDecorators);
  editor._pendingDecorators = pendingDecorators;
  return pendingDecorators;
}

export function reconcileDecorator(
  activeEditor: LexicalEditor,
  key: NodeKey,
  decorator: unknown,
): void {
  let pendingDecorators = activeEditor._pendingDecorators;
  const currentDecorators = activeEditor._decorators;

  if (pendingDecorators === null) {
    if (currentDecorators[key] === decorator) {
      return;
    }

    pendingDecorators = cloneDecorators(activeEditor);
  }

  pendingDecorators[key] = decorator;
}
