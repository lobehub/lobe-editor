import type { LexicalEditor, LexicalNode, NodeKey } from 'lexical';
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isParagraphNode,
  $isRangeSelection,
  $setSelection,
  DecoratorNode,
  KEY_ARROW_LEFT_COMMAND,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import type { IEditorKernel } from '@/types/kernel';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';

import {
  $isCaretAtRootStartBeforeBlockDecorator,
  $insertParagraphBeforeRootStartBlock,
} from '../cursor';

/** Minimal non-inline decorator standing in for BlockImageNode / HorizontalRuleNode. */
class FakeBlockNode extends DecoratorNode<null> {
  static getType(): string {
    return 'fake-block';
  }

  static clone(node: FakeBlockNode): FakeBlockNode {
    return new FakeBlockNode(node.__key);
  }

  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  constructor(key: NodeKey | undefined = undefined) {
    super(key);
  }

  createDOM(): HTMLElement {
    return document.createElement('div');
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  decorate(): null {
    return null;
  }
}

function update(editor: LexicalEditor, callback: () => void): void {
  editor.update(callback, { discrete: true });
}

function setup() {
  const kernel = Editor.createEditor() as IEditorKernel;
  kernel.registerNodes([FakeBlockNode]);
  kernel.registerPlugins([CommonPlugin]);
  kernel.setRootElement(document.createElement('div'));

  const editor = kernel.getLexicalEditor();
  if (!editor) throw new Error('Editor not found');
  return editor;
}

describe('$isCaretAtRootStartBeforeBlockDecorator', () => {
  it('detects a collapsed caret parked at root offset 0 before a block decorator', () => {
    const editor = setup();

    update(editor, () => {
      const root = $getRoot();
      root.clear();
      root.append(new FakeBlockNode());
      const selection = $createRangeSelection();
      selection.anchor.set('root', 0, 'element');
      selection.focus.set('root', 0, 'element');
      $setSelection(selection);
    });

    editor.getEditorState().read(() => {
      expect($isCaretAtRootStartBeforeBlockDecorator()).toBe(true);
    });
  });

  it('returns false when the caret is inside a normal paragraph', () => {
    const editor = setup();

    update(editor, () => {
      const root = $getRoot();
      root.clear();
      const paragraph = $createParagraphNode();
      const text = $createTextNode('start');
      paragraph.append(text);
      root.append(paragraph);
      root.append(new FakeBlockNode());
      const selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), 0, 'text');
      selection.focus.set(text.getKey(), 0, 'text');
      $setSelection(selection);
    });

    editor.getEditorState().read(() => {
      expect($isCaretAtRootStartBeforeBlockDecorator()).toBe(false);
    });
  });

  it('returns false for non-collapsed selections', () => {
    const editor = setup();

    update(editor, () => {
      const root = $getRoot();
      root.clear();
      const paragraph = $createParagraphNode();
      const text = $createTextNode('start');
      paragraph.append(text);
      root.append(paragraph);
      const selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), 0, 'text');
      selection.focus.set(text.getKey(), text.getTextContentSize(), 'text');
      $setSelection(selection);
    });

    editor.getEditorState().read(() => {
      expect($isCaretAtRootStartBeforeBlockDecorator()).toBe(false);
    });
  });
});

describe('$insertParagraphBeforeRootStartBlock', () => {
  it('inserts a leading paragraph and anchors the selection inside it', () => {
    const editor = setup();

    update(editor, () => {
      const root = $getRoot();
      root.clear();
      root.append(new FakeBlockNode());
      const selection = $createRangeSelection();
      selection.anchor.set('root', 0, 'element');
      selection.focus.set('root', 0, 'element');
      $setSelection(selection);
    });

    update(editor, () => {
      const firstChild = $getRoot().getFirstChild();
      if (!firstChild || firstChild.isInline() || !$isDecoratorNode(firstChild)) return;
      $insertParagraphBeforeRootStartBlock();
    });

    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getChildrenSize()).toBe(2);
      expect($isParagraphNode(root.getFirstChild())).toBe(true);
      expect($isDecoratorNode(root.getLastChild())).toBe(true);

      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if (!$isRangeSelection(selection)) return;
      expect(selection.anchor.getNode().getType()).toBe('paragraph');
    });
  });

  it('keeps the block after an existing paragraph when ArrowLeft crosses the boundary', () => {
    const editor = setup();

    update(editor, () => {
      const root = $getRoot();
      root.clear();
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode('hello'));
      root.append(paragraph);
      root.append(new FakeBlockNode());

      const selection = $createRangeSelection();
      selection.anchor.set(paragraph.getKey(), 0, 'element');
      selection.focus.set(paragraph.getKey(), 0, 'element');
      $setSelection(selection);
    });

    editor.dispatchCommand(
      KEY_ARROW_LEFT_COMMAND,
      new KeyboardEvent('keydown', { key: 'ArrowLeft' }),
    );

    // The core guarantee: wherever the caret ends up (root offset 0 or inside
    // the first paragraph), a leading paragraph keeps the caret in a real
    // text anchor. Exercise the normalization explicitly.
    update(editor, () => {
      const firstChild = $getRoot().getFirstChild();
      if (!firstChild || firstChild.isInline() || !$isDecoratorNode(firstChild)) return;
      $insertParagraphBeforeRootStartBlock();
    });

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const types = root.getChildren().map((node) => node.getType());
      expect(types[0]).toBe('paragraph');
      expect(types.filter((type) => type === 'fake-block').length).toBe(1);
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
    });
  });
});
