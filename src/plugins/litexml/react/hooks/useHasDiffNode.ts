import { useEffect, useState } from 'react';

import { IEditor } from '@/types';

export function useHasDiffNode(editor: IEditor) {
  const [hasInit, setHasInit] = useState(!!editor.getLexicalEditor());
  const [hasDiff, setHasDiff] = useState(
    editor
      .getLexicalEditor()
      ?.getEditorState()
      ._nodeMap.values()
      .some((node) => node.getType() === 'diff') || false,
  );

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
      const hasDiffNode =
        editor
          .getLexicalEditor()
          ?.getEditorState()
          ._nodeMap.values()
          .some((node) => node.getType() === 'diff') || false;
      setHasDiff(hasDiffNode);
    });
    return () => {
      unregister?.();
    };
  }, [editor, hasInit]);

  return {
    hasDiff,
  };
}
