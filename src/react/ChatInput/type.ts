import type { CSSProperties, ReactNode } from 'react';

export interface ChatInputProps {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  maxHeight?: string | number;
  style?: CSSProperties;
}
