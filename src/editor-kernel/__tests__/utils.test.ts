import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('lexical', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lexical')>();
  return {
    ...actual,
    $getNodeByKey: vi.fn(),
  };
});

import {
  $getNearestNodeFromDOMNode,
  $getNodeFromDOMNode,
  DOM_DOCUMENT_FRAGMENT_TYPE,
  DOM_DOCUMENT_TYPE,
  DOM_ELEMENT_TYPE,
  DOM_TEXT_TYPE,
  assert,
  compareNodeOrder,
  createEmptyEditorState,
  genServiceId,
  getKernelFromEditor,
  getNodeKeyFromDOMNode,
  getParentElement,
  isDOMNode,
  isDocumentFragment,
  noop,
} from '../utils';
import { $getNodeByKey, createEditor } from 'lexical';

const getNodeByKeyMock = $getNodeByKey as unknown as Mock;

class MockNode {
  parent: MockNode | null = null;
  children: MockNode[] = [];
  constructor(public readonly key: string) {}
  addChild(child: MockNode) {
    child.parent = this;
    this.children.push(child);
  }
  getParent() {
    return this.parent as unknown as import('lexical').LexicalNode | null;
  }
  getChildren() {
    return this.children as unknown as import('lexical').LexicalNode[];
  }
}

describe('editor kernel utils', () => {
  beforeEach(() => {
    getNodeByKeyMock.mockReset();
  });

  it('should expose DOM type constants', () => {
    expect(DOM_ELEMENT_TYPE).toBe(1);
    expect(DOM_TEXT_TYPE).toBe(3);
    expect(DOM_DOCUMENT_TYPE).toBe(9);
    expect(DOM_DOCUMENT_FRAGMENT_TYPE).toBe(11);
  });

  it('genServiceId should wrap value with service id marker', () => {
    const service = genServiceId<'test'>('demo');
    expect(service).toEqual({ __serviceId: 'demo' });
  });

  it('noop should do nothing', () => {
    expect(noop()).toBeUndefined();
  });

  it('createEmptyEditorState should create an empty lexical state', () => {
    const editorState = createEmptyEditorState();
    expect(typeof editorState.read).toBe('function');
    expect(editorState.isEmpty()).toBe(true);
  });

  it('assert should throw when condition is false', () => {
    expect(() => assert(true, 'ok')).not.toThrow();
    expect(() => assert(false, 'boom')).toThrowError('boom');
  });

  it('getNodeKeyFromDOMNode should read lexical key metadata', () => {
    const editor = createEditor();
    const dom = document.createElement('div');
    const key = `__lexicalKey_${editor._key}`;
    (dom as unknown as Record<string, unknown>)[key] = 'node-key';

    expect(getNodeKeyFromDOMNode(dom, editor)).toBe('node-key');
  });

  it('getNodeKeyFromDOMNode should return undefined when key missing', () => {
    const editor = createEditor();
    const dom = document.createElement('div');

    expect(getNodeKeyFromDOMNode(dom, editor)).toBeUndefined();
  });

  it('$getNodeFromDOMNode should return node when key is registered', () => {
    const editor = createEditor();
    const dom = document.createElement('div');
    const key = `__lexicalKey_${editor._key}`;
    const lexicalNode = { key: 'resolved' } as unknown as import('lexical').LexicalNode;

    (dom as unknown as Record<string, unknown>)[key] = 'registered';
    getNodeByKeyMock.mockReturnValueOnce(lexicalNode);

    expect($getNodeFromDOMNode(dom, editor)).toBe(lexicalNode);
    expect(getNodeByKeyMock).toHaveBeenCalledWith('registered', undefined);
  });

  it('$getNodeFromDOMNode should return null when key is missing', () => {
    const editor = createEditor();
    const dom = document.createElement('div');

    expect($getNodeFromDOMNode(dom, editor)).toBeNull();
    expect(getNodeByKeyMock).not.toHaveBeenCalled();
  });

  it('isDOMNode should detect DOM nodes correctly', () => {
    expect(isDOMNode(document.createElement('div'))).toBe(true);
    expect(isDOMNode('not-node')).toBe(false);
  });

  it('isDocumentFragment should detect fragments', () => {
    const fragment = document.createDocumentFragment();
    expect(isDocumentFragment(fragment)).toBe(true);
    expect(isDocumentFragment(document.createElement('span'))).toBe(false);
  });

  it('getParentElement should unwrap document fragment host', () => {
    const node = document.createElement('span');
    const fragment = document.createDocumentFragment();
    const host = document.createElement('div');

    Object.defineProperty(node, 'parentElement', { value: fragment });
    Object.defineProperty(fragment, 'host', { value: host, configurable: true });

    expect(getParentElement(node)).toBe(host);
  });

  it('getParentElement should prefer assigned slot when available', () => {
    const node = document.createElement('span');
    const slot = document.createElement('div');

    Object.defineProperty(node, 'assignedSlot', { value: slot, configurable: true });

    expect(getParentElement(node)).toBe(slot);
  });

  it('$getNearestNodeFromDOMNode should find nearest registered node', () => {
    const editor = createEditor();
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);

    const parentKey = `__lexicalKey_${editor._key}`;
    (parent as unknown as Record<string, unknown>)[parentKey] = 'parent';

    const lexicalNode = { key: 'parent' } as unknown as import('lexical').LexicalNode;
    getNodeByKeyMock.mockImplementation((key) => (key === 'parent' ? lexicalNode : null));

    expect($getNearestNodeFromDOMNode(child, editor)).toBe(lexicalNode);
    expect(getNodeByKeyMock).toHaveBeenCalledTimes(1);
    expect(getNodeByKeyMock).toHaveBeenCalledWith('parent', undefined);
  });

  it('getKernelFromEditor should read injected kernel', () => {
    const kernel = { id: 'kernel' } as unknown as import('@/types').IEditorKernel;
    const editorWithKernel = { _kernel: kernel } as unknown as import('lexical').LexicalEditor;
    expect(getKernelFromEditor(editorWithKernel)).toBe(kernel);

    const editorWithArgs = {
      _createEditorArgs: { __kernel: kernel },
    } as unknown as import('lexical').LexicalEditor;
    expect(getKernelFromEditor(editorWithArgs)).toBe(kernel);
  });

  it('compareNodeOrder should handle identical nodes and hierarchy', () => {
    const root = new MockNode('root');
    const childA = new MockNode('a');
    const childB = new MockNode('b');
    const grandChild = new MockNode('c');

    root.addChild(childA);
    root.addChild(childB);
    childA.addChild(grandChild);

    const lexicalChildA = childA as unknown as import('lexical').LexicalNode;
    const lexicalChildB = childB as unknown as import('lexical').LexicalNode;
    const lexicalGrandChild = grandChild as unknown as import('lexical').LexicalNode;

    expect(compareNodeOrder(lexicalChildA, lexicalChildA)).toBe(0);
    expect(compareNodeOrder(lexicalChildA, lexicalChildB)).toBeLessThan(0);
    expect(compareNodeOrder(lexicalChildB, lexicalChildA)).toBeGreaterThan(0);
    expect(compareNodeOrder(lexicalGrandChild, lexicalChildA)).toBeGreaterThan(0);
  });
});
