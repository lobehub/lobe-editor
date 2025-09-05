import { useMemo } from 'react';

import Editor from '@/editor-kernel';
import type { IEditor } from '@/types';

export const useEditor = (): IEditor => {
  return useMemo(() => Editor.createEditor(), []);
};
