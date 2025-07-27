import type { LexicalEditor, NodeKey } from 'lexical';
import {
  $createNodeSelection,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $setSelection,
} from 'lexical';
import { useCallback, useEffect, useState } from 'react';
import { useLexicalComposerContext } from './react-context';

/**
 * A helper function to determine if a specific node is selected in a Lexical editor.
 *
 * @param {LexicalEditor} editor - The LexicalEditor instance.
 * @param {NodeKey} key - The key of the node to check.
 * @returns {boolean} Whether the node is selected.
 */

function isNodeSelected(editor: LexicalEditor | null, key: NodeKey): boolean {
  if (!editor) return false;
  return editor.getEditorState().read(() => {
    const node = $getNodeByKey(key);

    if (node === null) {
      return false; // Node doesn't exist, so it's not selected.
    }

    return node.isSelected(); // Check if the node is selected.
  });
}

/**
 * A custom hook to manage the selection state of a specific node in a Lexical editor.
 *
 * This hook provides utilities to:
 * - Check if a node is selected.
 * - Update its selection state.
 * - Clear the selection.
 *
 * @param {NodeKey} key - The key of the node to track selection for.
 * @returns {[boolean, (selected: boolean) => void, () => void]} A tuple containing:
 * - `isSelected` (boolean): Whether the node is currently selected.
 * - `setSelected` (function): A function to set the selection state of the node.
 * - `clearSelected` (function): A function to clear the selection of the node.
 *
 */

export function useLexicalNodeSelection(
  key: NodeKey,
): [boolean, (selected: boolean) => void, () => void] {
  const [editor] = useLexicalComposerContext();
  const lexicalEditor = editor.getLexicalEditor();

  // State to track whether the node is currently selected.
  const [isSelected, setIsSelected] = useState(() =>
    isNodeSelected(lexicalEditor, key),
  );

  useEffect(() => {
    let isMounted = true;
    if (!lexicalEditor) return;
    const unregister = lexicalEditor.registerUpdateListener(() => {
      if (isMounted) {
        setIsSelected(isNodeSelected(lexicalEditor, key));
      }
    });

    return () => {
      isMounted = false; // Prevent updates after component unmount.
      unregister();
    };
  }, [lexicalEditor, key]);

  const setSelected = useCallback(
    (selected: boolean) => {
      if (!lexicalEditor) return;
      lexicalEditor.update(() => {
        let selection = $getSelection();

        if (!$isNodeSelection(selection)) {
          selection = $createNodeSelection();
          $setSelection(selection);
        }

        if ($isNodeSelection(selection)) {
          if (selected) {
            selection.add(key);
          } else {
            selection.delete(key);
          }
        }
      });
    }, [lexicalEditor, key],
  );

  const clearSelected = useCallback(() => {
    if (!lexicalEditor) return;
    lexicalEditor.update(() => {
      const selection = $getSelection();

      if ($isNodeSelection(selection)) {
        selection.clear();
      }
    });
  }, [lexicalEditor]);

  return [isSelected, setSelected, clearSelected];
}
