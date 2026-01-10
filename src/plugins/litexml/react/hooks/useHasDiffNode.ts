import { useEffect, useState } from 'react';

import { IEditor } from '@/types';

function hasDiffNode(editor: IEditor): boolean {
  const values = editor.getLexicalEditor()?.getEditorState()._nodeMap.values();
  if (!values) {
    return false;
  }
  for (const node of values) {
    if (node.getType() === 'diff') {
      return true;
    }
  }
  return false;
}

export function useHasDiffNode(editor: IEditor) {
  const [hasInit, setHasInit] = useState(!!editor.getLexicalEditor());
  const [hasDiff, setHasDiff] = useState(hasDiffNode(editor));

  useEffect(() => {
    const handle = () => {
      setHasInit(true);
    };
    editor.on('initialized', handle);
    return () => {
      editor.off('initialized', handle);
    };
  }, [editor]);

  useEffect(() => {
    const unregister = editor.getLexicalEditor()?.registerUpdateListener(() => {
      setHasDiff(hasDiffNode(editor));
    });
    return () => {
      unregister?.();
    };
  }, [editor, hasInit]);

  return {
    hasDiff,
  };
}
