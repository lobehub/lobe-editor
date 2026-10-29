import { $createListItemNode, $createListNode, ListItemNode, ListNode } from '@lexical/list';
import {
  $applyNodeReplacement,
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $setSelection,
  DecoratorNode,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  LexicalEditor,
  SerializedLexicalNode,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { ListPlugin } from '@/plugins/list';
import type { IEditorKernel } from '@/types';

import { VirtualBlockPlugin } from './index';

type SerializedTestDecoratorNode = SerializedLexicalNode & {
  type: 'test-decorator';
};

class TestDecoratorNode extends DecoratorNode<null> {
  static clone(node: TestDecoratorNode): TestDecoratorNode {
    return new TestDecoratorNode(node.__key);
  }

  static getType(): string {
    return 'test-decorator';
  }

  static importJSON(): TestDecoratorNode {
    return new TestDecoratorNode();
  }

  createDOM(): HTMLElement {
    return document.createElement('div');
  }

  decorate(): null {
    return null;
  }

  exportJSON(): SerializedTestDecoratorNode {
    return {
      ...super.exportJSON(),
      type: 'test-decorator',
    };
  }

  updateDOM(): false {
    return false;
  }
}

function $createTestDecoratorNode(): TestDecoratorNode {
  return $applyNodeReplacement(new TestDecoratorNode());
}

function update(editor: LexicalEditor, callback: () => void): void {
  editor.update(callback, { discrete: true });
}

function createTestEditor(): LexicalEditor {
  const kernel = Editor.createEditor() as IEditorKernel;
  kernel.registerNodes([TestDecoratorNode]);
  kernel.registerPlugins([CommonPlugin, ListPlugin, VirtualBlockPlugin]);
  kernel.setRootElement(document.createElement('div'));

  const editor = kernel.getLexicalEditor();
  if (!editor) {
    throw new Error('Editor not found');
  }
  return editor;
}

function setRangeSelection(editor: LexicalEditor, key: string, offset: number): void {
  update(editor, () => {
    const selection = $createRangeSelection();
    selection.anchor.set(key, offset, 'text');
    selection.focus.set(key, offset, 'text');
    $setSelection(selection);
  });
}

describe('VirtualBlockPlugin list arrow navigation', () => {
  it('does not create a virtual paragraph above the list from a non-boundary list item', () => {
    const editor = createTestEditor();
    let secondTextKey = '';

    update(editor, () => {
      const root = $getRoot();
      root.clear();

      const decorator = $createTestDecoratorNode();
      const list = $createListNode('number');
      const firstItem = $createListItemNode();
      const firstText = $createTextNode('first');
      const secondItem = $createListItemNode();
      const secondText = $createTextNode('second');

      firstItem.append(firstText);
      secondItem.append(secondText);
      list.append(firstItem, secondItem);
      root.append(decorator, list);

      secondTextKey = secondText.getKey();
      const selection = $createRangeSelection();
      selection.anchor.set(secondTextKey, 0, 'text');
      selection.focus.set(secondTextKey, 0, 'text');
      $setSelection(selection);
    });

    const handled = editor.dispatchCommand(
      KEY_ARROW_UP_COMMAND,
      new KeyboardEvent('keydown', { key: 'ArrowUp' }),
    );
    expect(handled).toBe(false);

    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getChildrenSize()).toBe(2);
      expect(root.getFirstChild()?.getType()).toBe('test-decorator');
      expect(root.getLastChild()?.getType()).toBe('list');

      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if (!$isRangeSelection(selection)) return;
      expect(selection.focus.key).toBe(secondTextKey);
    });
  });

  it('does not create a virtual paragraph below the list from a non-boundary list item', () => {
    const editor = createTestEditor();
    let firstTextKey = '';
    let firstTextSize = 0;

    update(editor, () => {
      const root = $getRoot();
      root.clear();

      const list = $createListNode('number');
      const firstItem = $createListItemNode();
      const firstText = $createTextNode('first');
      const secondItem = $createListItemNode();
      const secondText = $createTextNode('second');

      firstItem.append(firstText);
      secondItem.append(secondText);
      list.append(firstItem, secondItem);
      root.append(list);

      firstTextKey = firstText.getKey();
      firstTextSize = firstText.getTextContentSize();
      const selection = $createRangeSelection();
      selection.anchor.set(firstTextKey, firstTextSize, 'text');
      selection.focus.set(firstTextKey, firstTextSize, 'text');
      $setSelection(selection);
    });

    const handled = editor.dispatchCommand(
      KEY_ARROW_DOWN_COMMAND,
      new KeyboardEvent('keydown', { key: 'ArrowDown' }),
    );
    expect(handled).toBe(false);

    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getChildrenSize()).toBe(1);
      expect(root.getFirstChild()?.getType()).toBe('list');

      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if (!$isRangeSelection(selection)) return;
      expect(selection.focus.key).toBe(firstTextKey);
    });
  });

  it('creates and cleans an empty virtual paragraph before a list from the first list item', async () => {
    const editor = createTestEditor();
    let firstTextKey = '';
    let secondTextKey = '';

    update(editor, () => {
      const root = $getRoot();
      root.clear();

      const decorator = $createTestDecoratorNode();
      const list = $createListNode('number');
      const firstItem = $createListItemNode();
      const firstText = $createTextNode('first');
      const secondItem = $createListItemNode();
      const secondText = $createTextNode('second');

      firstItem.append(firstText);
      secondItem.append(secondText);
      list.append(firstItem, secondItem);
      root.append(decorator, list);

      firstTextKey = firstText.getKey();
      secondTextKey = secondText.getKey();
      const selection = $createRangeSelection();
      selection.anchor.set(firstTextKey, 2, 'text');
      selection.focus.set(firstTextKey, 2, 'text');
      $setSelection(selection);
    });

    const handled = editor.dispatchCommand(
      KEY_ARROW_UP_COMMAND,
      new KeyboardEvent('keydown', { key: 'ArrowUp' }),
    );
    expect(handled).toBe(true);
    await Promise.resolve();

    let paragraphKey = '';
    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getChildrenSize()).toBe(3);
      const paragraph = root.getChildAtIndex(1);
      expect($isParagraphNode(paragraph)).toBe(true);
      paragraphKey = paragraph?.getKey() || '';
    });

    setRangeSelection(editor, secondTextKey, 0);
    await Promise.resolve();

    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getChildrenSize()).toBe(2);
      expect(root.getChildren().some((node) => node.getKey() === paragraphKey)).toBe(false);
    });
  });

  it('creates and cleans an empty virtual paragraph after a list from the last list item', async () => {
    const editor = createTestEditor();
    let firstTextKey = '';
    let lastTextKey = '';

    update(editor, () => {
      const root = $getRoot();
      root.clear();

      const list = $createListNode('number');
      const firstItem = $createListItemNode();
      const firstText = $createTextNode('first');
      const lastItem = $createListItemNode();
      const lastText = $createTextNode('last');

      firstItem.append(firstText);
      lastItem.append(lastText);
      list.append(firstItem, lastItem);
      root.append(list);

      firstTextKey = firstText.getKey();
      lastTextKey = lastText.getKey();
      const selection = $createRangeSelection();
      selection.anchor.set(lastTextKey, 2, 'text');
      selection.focus.set(lastTextKey, 2, 'text');
      $setSelection(selection);
    });

    const handled = editor.dispatchCommand(
      KEY_ARROW_DOWN_COMMAND,
      new KeyboardEvent('keydown', { key: 'ArrowDown' }),
    );
    expect(handled).toBe(true);
    await Promise.resolve();

    let paragraphKey = '';
    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getChildrenSize()).toBe(2);
      const paragraph = root.getLastChild();
      expect($isParagraphNode(paragraph)).toBe(true);
      paragraphKey = paragraph?.getKey() || '';
    });

    setRangeSelection(editor, firstTextKey, 0);
    await Promise.resolve();

    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getChildrenSize()).toBe(1);
      expect(root.getChildren().some((node) => node.getKey() === paragraphKey)).toBe(false);
    });
  });

  it('creates a virtual paragraph from a list element selection at the lower boundary', async () => {
    const editor = createTestEditor();

    update(editor, () => {
      const root = $getRoot();
      root.clear();

      const list = $createListNode('number');
      const firstItem = $createListItemNode();
      const firstText = $createTextNode('first');
      const lastItem = $createListItemNode();
      const lastText = $createTextNode('last');

      firstItem.append(firstText);
      lastItem.append(lastText);
      list.append(firstItem, lastItem);
      root.append(list);

      const selection = $createRangeSelection();
      selection.anchor.set(list.getKey(), list.getChildrenSize(), 'element');
      selection.focus.set(list.getKey(), list.getChildrenSize(), 'element');
      $setSelection(selection);
    });

    const handled = editor.dispatchCommand(
      KEY_ARROW_DOWN_COMMAND,
      new KeyboardEvent('keydown', { key: 'ArrowDown' }),
    );
    expect(handled).toBe(true);
    await Promise.resolve();

    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getChildrenSize()).toBe(2);
      expect(root.getFirstChild()?.getType()).toBe('list');
      expect($isParagraphNode(root.getLastChild())).toBe(true);
    });
  });

  it('does not throw when checking an empty block with a non-element child', () => {
    const editor = createTestEditor();
    let textKey = '';

    update(editor, () => {
      const root = $getRoot();
      root.clear();

      const paragraph = $createParagraphNode();
      const text = $createTextNode('');
      paragraph.append(text, $createTestDecoratorNode());
      root.append(paragraph);

      textKey = text.getKey();
      const selection = $createRangeSelection();
      selection.anchor.set(textKey, 0, 'text');
      selection.focus.set(textKey, 0, 'text');
      $setSelection(selection);
    });

    expect(() =>
      editor.dispatchCommand(
        KEY_ARROW_DOWN_COMMAND,
        new KeyboardEvent('keydown', { key: 'ArrowDown' }),
      ),
    ).not.toThrow();
  });
});
