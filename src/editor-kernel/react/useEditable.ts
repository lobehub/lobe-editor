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
    const handleInitialized = () => {
      setEditable(editor.isEditable());
    };
    editor.on('editableChange', updateEditable);
    editor.on('initialized', handleInitialized);
    return () => {
      editor.off('editableChange', updateEditable);
      editor.off('initialized', handleInitialized);
    };
  }, [editor]);

  return { editable };
};
