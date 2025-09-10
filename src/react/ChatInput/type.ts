import type { CSSProperties, ReactNode, Ref } from 'react';
import { FlexboxProps } from 'react-layout-kit';

export interface ChatInputProps extends Omit<FlexboxProps, 'height'> {
  classNames?: {
    body?: string;
  };
  defaultHeight?: number;
  footer?: ReactNode;
  fullscreen?: boolean;
  header?: ReactNode;
  headerHeight?: number;
  height?: number;
  maxHeight?: number;
  minHeight?: number;
  onSizeChange?: (height: number) => void;
  onSizeDragging?: (height: number) => void;
  resize?: boolean;
  slashMenuRef?: Ref<HTMLDivElement>;
  styles?: {
    body?: CSSProperties;
  };
}
