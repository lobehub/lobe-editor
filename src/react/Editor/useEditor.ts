import { useRef } from 'react';

import { IEditor } from '@/editor-kernel';

export const useEditor = () => {
  return useRef<IEditor | null>(null);
};
