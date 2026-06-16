import { $createListItemNode, $createListNode, ListItemNode, ListNode } from '@lexical/list';
import {
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  KEY_ARROW_DOWN_COMMAND,
  LexicalEditor,
  LexicalNode,
  createEditor,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { ListPlugin } from '@/plugins/list';

import { $getAdjacentNode } from './register';

function update(editor: LexicalEditor, callback: () => void): void {
  editor.update(callback, { discrete: true });
}

describe('$getAdjacentNode', () => {
  it('should not wrap from the first list item to the last item when moving backward', () => {
    const editor = createEditor({
      namespace: 'adjacent-node-test',
      nodes: [ListNode, ListItemNode],
      onError: (error) => {
        throw error;
      },
    });
    let adjacentNode: LexicalNode | null = null;

    update(editor, () => {
      const root = $getRoot();
      root.clear();

      const list = $createListNode('bullet');
      const firstItem = $createListItemNode();
      const firstText = $createTextNode('first');
      const lastItem = $createListItemNode();
      const lastText = $createTextNode('last');

      firstItem.append(firstText);
      lastItem.append(lastText);
      list.append(firstItem, lastItem);
      root.append(list);

      const selection = $createRangeSelection();
      selection.anchor.set(firstText.getKey(), 0, 'text');
      selection.focus.set(firstText.getKey(), 0, 'text');
      $setSelection(selection);

      adjacentNode = $getAdjacentNode(selection.focus, true);
    });

    expect(adjacentNode).toBeNull();
  });

  it('should resolve the next list item when moving forward from the first item', () => {
    const editor = createEditor({
      namespace: 'adjacent-node-test',
      nodes: [ListNode, ListItemNode],
      onError: (error) => {
        throw error;
      },
    });
    let adjacentNodeKey = '';
    let secondItemKey = '';

    update(editor, () => {
      const root = $getRoot();
      root.clear();

      const list = $createListNode('bullet');
      const firstItem = $createListItemNode();
      const firstText = $createTextNode('first');
      const secondItem = $createListItemNode();
      const secondText = $createTextNode('second');
      const lastItem = $createListItemNode();
      const lastText = $createTextNode('last');

      firstItem.append(firstText);
      secondItem.append(secondText);
      lastItem.append(lastText);
      list.append(firstItem, secondItem, lastItem);
      root.append(list);

      secondItemKey = secondItem.getKey();
      const selection = $createRangeSelection();
      selection.anchor.set(firstText.getKey(), firstText.getTextContentSize(), 'text');
      selection.focus.set(firstText.getKey(), firstText.getTextContentSize(), 'text');
      $setSelection(selection);

      adjacentNodeKey = $getAdjacentNode(selection.focus, false)?.getKey() || '';
    });

    expect(adjacentNodeKey).toBe(secondItemKey);
  });
});

describe('CommonPlugin list arrow navigation', () => {
  it('should leave ArrowDown inside list items unhandled', () => {
    const kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, ListPlugin]);
    kernel.setRootElement(document.createElement('div'));

    const editor = kernel.getLexicalEditor();
    if (!editor) {
      throw new Error('Editor not found');
    }

    let firstTextKey = '';
    let lastTextKey = '';
    let lastTextSize = 0;

    update(editor, () => {
      const root = $getRoot();
      root.clear();

      const list = $createListNode('bullet');
      const firstItem = $createListItemNode();
      const firstText = $createTextNode('first');
      const secondItem = $createListItemNode();
      const secondText = $createTextNode('second');
      const lastItem = $createListItemNode();
      const lastText = $createTextNode('last');

      firstItem.append(firstText);
      secondItem.append(secondText);
      lastItem.append(lastText);
      list.append(firstItem, secondItem, lastItem);
      root.append(list);

      firstTextKey = firstText.getKey();
      lastTextKey = lastText.getKey();
      lastTextSize = lastText.getTextContentSize();

      const selection = $createRangeSelection();
      selection.anchor.set(firstTextKey, firstText.getTextContentSize(), 'text');
      selection.focus.set(firstTextKey, firstText.getTextContentSize(), 'text');
      $setSelection(selection);
    });

    const handledFromFirstItem = editor.dispatchCommand(
      KEY_ARROW_DOWN_COMMAND,
      new KeyboardEvent('keydown', { key: 'ArrowDown' }),
    );
    expect(handledFromFirstItem).toBe(false);

    editor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if (!$isRangeSelection(selection)) return;

      expect(selection.focus.key).toBe(firstTextKey);
    });

    update(editor, () => {
      const selection = $createRangeSelection();
      selection.anchor.set(lastTextKey, lastTextSize, 'text');
      selection.focus.set(lastTextKey, lastTextSize, 'text');
      $setSelection(selection);
    });

    const handledFromLastItem = editor.dispatchCommand(
      KEY_ARROW_DOWN_COMMAND,
      new KeyboardEvent('keydown', { key: 'ArrowDown' }),
    );
    expect(handledFromLastItem).toBe(false);

    editor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if (!$isRangeSelection(selection)) return;

      expect(selection.focus.key).toBe(lastTextKey);
      expect(selection.focus.offset).toBe(lastTextSize);
    });
  });
});
