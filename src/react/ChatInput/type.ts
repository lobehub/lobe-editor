import type { FlexboxProps } from '@lobehub/ui';
import type { CSSProperties, ReactNode, Ref } from 'react';

export interface ChatInputProps extends Omit<FlexboxProps, 'height'> {
  classNames?: {
    body?: string;
    footer?: string;
    header?: string;
  };
  defaultHeight?: number;
  footer?: ReactNode;
  fullscreen?: boolean;
  header?: ReactNode;
  height?: number;
  maxHeight?: number;
  minHeight?: number;
  onBodyClick?: FlexboxProps['onClick'];
  onSizeChange?: (height: number) => void;
  onSizeDragging?: (height: number) => void;
  resize?: boolean;
  resizeMaxHeightOffset?: number;
  showResizeHandle?: boolean;
  slashMenuRef?: Ref<HTMLDivElement>;
  styles?: {
    body?: CSSProperties;
    footer?: CSSProperties;
    header?: CSSProperties;
  };
}
