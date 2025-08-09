'use client';

import { ReactNode, createContext, memo, use } from 'react';

import { IEditor } from '@/editor-kernel';

export const EditorContext = createContext<IEditor | undefined>(undefined);

export const EditorProvider = memo<{ children: ReactNode; editor?: IEditor }>(
  ({ children, editor }) => {
    return <EditorContext value={editor}>{children}</EditorContext>;
  },
);

export const useEditor = () => {
  return use(EditorContext);
};
