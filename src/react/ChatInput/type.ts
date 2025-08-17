import type { CSSProperties, ReactNode, Ref } from 'react';

export interface ChatInputProps {
  children?: ReactNode;
  className?: string;
  footer?: ReactNode;
  header?: ReactNode;
  maxHeight?: string | number;
  slashMenuRef?: Ref<HTMLDivElement>;
  style?: CSSProperties;
}
