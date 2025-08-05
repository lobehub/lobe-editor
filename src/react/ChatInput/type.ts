import { CSSProperties } from 'react';

import type { EditorProps } from '../Editor/type';

export interface ChatInputProps
  extends Pick<EditorProps, 'plugins' | 'content' | 'mentionOption' | 'slashOption'> {
  className?: string;
  placeholder?: string;
  style?: CSSProperties;
}
