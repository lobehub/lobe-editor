import type { BlockProps, MenuProps } from '@lobehub/ui';
import type { CSSProperties } from 'react';

import type { MenuRenderProps } from '@/plugins/slash';

export interface SlashMenuProps extends MenuRenderProps {
  className?: string;
  classNames?: {
    container?: string;
    menu?: string;
    root?: string;
  };
  containerProps?: Omit<BlockProps, 'children'>;
  getPopupContainer: () => HTMLDivElement | null;
  maxHeight?: string | number;
  menuProps?: MenuProps;
  style?: CSSProperties;
  styles?: {
    container?: CSSProperties;
    menu?: CSSProperties;
    root?: CSSProperties;
  };
}
