import type { BlockProps } from '@lobehub/ui';
import type { CSSProperties, ReactNode } from 'react';

export interface FloatMenuProps {
  children?: ReactNode;
  className?: string;
  classNames?: {
    container?: string;
    root?: string;
  };
  containerProps?: Omit<BlockProps, 'children'>;
  getPopupContainer: () => HTMLDivElement | null;
  maxHeight?: string | number;
  open?: boolean;
  style?: CSSProperties;
  styles?: {
    container?: CSSProperties;
    root?: CSSProperties;
  };
}
