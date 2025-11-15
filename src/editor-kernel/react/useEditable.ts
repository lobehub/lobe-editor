'use client';

import { useEffect, useState } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

export const useEditable = () => {
  const [editor] = useLexicalComposerContext();
  // Don't render portal on server side
  const [editable, setEditable] = useState<boolean>(editor.isEditable());

  useEffect(() => {
    const updateEditable = (newEditable: boolean) => {
      setEditable(newEditable);
    };
    editor.on('editableChange', updateEditable);
    return () => {
      editor.off('editableChange', updateEditable);
    };
  }, [editor]);

  return { editable };
};
