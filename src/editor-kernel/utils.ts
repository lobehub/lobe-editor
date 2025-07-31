import { $getNodeByKey, EditorState, LexicalEditor, LexicalNode, NodeKey } from "lexical";
import { IServiceID } from "./types";

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
    return new EditorState(new Map(), null);
}

export function assert(
    cond?: boolean,
    message?: string,
): asserts cond {
    if (cond) {
        return;
    }

    throw new Error(
        message,
    );
}

export function getNodeKeyFromDOMNode(
  dom: Node,
  editor: LexicalEditor,
): NodeKey | undefined {
  const prop = `__lexicalKey_${editor._key}`;
  return (dom as Node & Record<typeof prop, NodeKey | undefined>)[prop];
}

export function $getNodeFromDOMNode(
  dom: Node,
  editor: LexicalEditor,
  editorState?: EditorState,
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
  return (
    typeof x === 'object' &&
    x !== null &&
    'nodeType' in x &&
    typeof x.nodeType === 'number'
  );
}

/**
 * @param x - The element being testing
 * @returns Returns true if x is a document fragment, false otherwise.
 */
export function isDocumentFragment(x: unknown): x is DocumentFragment {
  return isDOMNode(x) && x.nodeType === DOM_DOCUMENT_FRAGMENT_TYPE;
}


export function getParentElement(node: Node): HTMLElement | null {
  const parentElement =
    (node as HTMLSlotElement).assignedSlot || node.parentElement;
  return isDocumentFragment(parentElement)
    ? ((parentElement as unknown as ShadowRoot).host as HTMLElement)
    : parentElement;
}

export function $getNearestNodeFromDOMNode(
  startingDOM: Node,
  editor: LexicalEditor,
  editorState?: EditorState,
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