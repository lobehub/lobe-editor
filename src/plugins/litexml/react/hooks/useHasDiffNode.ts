import type { EditorState, LexicalNode, NodeKey } from 'lexical';
import { useEffect, useState } from 'react';

import type { IEditor } from '@/types';

import { isWholeDocumentChange, type UpdateScope } from '../../update-scope';

const isDiffType = (node: LexicalNode) => {
  const nodeType = node.getType();
  return nodeType === 'diff' || nodeType === 'table-row-diff';
};

export function hasDiffNode(editor?: IEditor): boolean {
  if (!editor) {
    return false;
  }
  const values = editor.getLexicalEditor()?.getEditorState()._nodeMap.values();
  if (!values) {
    return false;
  }
  for (const node of values) {
    if (isDiffType(node)) {
      return true;
    }
  }
  return false;
}

/**
 * Keys of diff nodes, kept in step with each update from its dirty nodes so a typing or per-line
 * insert does not rescan the whole node map. Load/undo rebuilds it, since only the root is dirty.
 */
export function createDiffKeyTracker(editorState: EditorState) {
  const keys = new Set<NodeKey>();
  const rebuild = (state: EditorState) => {
    keys.clear();
    for (const [key, node] of state._nodeMap) if (isDiffType(node)) keys.add(key);
  };
  rebuild(editorState);

  return {
    has(): boolean {
      return keys.size > 0;
    },
    update(update: UpdateScope & { editorState: EditorState }): boolean {
      const nodeMap = update.editorState._nodeMap;
      if (isWholeDocumentChange(update)) {
        rebuild(update.editorState);
        return keys.size > 0;
      }
      const touch = (key: NodeKey) => {
        const node = nodeMap.get(key);
        if (node && isDiffType(node)) keys.add(key);
        else keys.delete(key);
      };
      update.dirtyElements.forEach((_, key) => touch(key));
      update.dirtyLeaves.forEach(touch);
      // A diff nested in a removed subtree is not dirty itself; drop keys that left the state.
      for (const key of keys) if (!nodeMap.has(key)) keys.delete(key);
      return keys.size > 0;
    },
  };
}

export function useHasDiffNode(editor?: IEditor) {
  const [hasInit, setHasInit] = useState(!!editor?.getLexicalEditor());
  const [hasDiff, setHasDiff] = useState(hasDiffNode(editor));

  useEffect(() => {
    if (!editor) {
      return;
    }
    const handle = () => {
      setHasInit(true);
    };
    editor.on('initialized', handle);
    return () => {
      editor.off('initialized', handle);
    };
  }, [editor]);

  useEffect(() => {
    const lexicalEditor = editor?.getLexicalEditor();
    if (!lexicalEditor || !hasInit) {
      return;
    }
    const tracker = createDiffKeyTracker(lexicalEditor.getEditorState());
    setHasDiff(tracker.has());
    const unregister = lexicalEditor.registerUpdateListener((update) => {
      setHasDiff(tracker.update(update));
    });
    return () => {
      unregister();
    };
  }, [editor, hasInit]);

  return {
    hasDiff,
  };
}
