import { RefObject, useRef } from 'react';

import type { IEditor } from '@/types';

export const useEditor = (editorRef?: RefObject<IEditor | null>) => {
  const ref = useRef<IEditor | null>(null);
  return editorRef || ref;
};
