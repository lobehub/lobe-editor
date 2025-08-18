import { useRef } from 'react';

import type { IEditor } from '@/types';

export const useEditor = () => {
  return useRef<IEditor | null>(null);
};
