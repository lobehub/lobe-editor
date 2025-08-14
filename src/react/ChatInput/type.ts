import type { CSSProperties, ReactNode } from 'react';

export interface ChatInputProps {
  children?: ReactNode;
  className?: string;
  footer?: ReactNode;
  header?: ReactNode;
  maxHeight?: string | number;
  style?: CSSProperties;
}
