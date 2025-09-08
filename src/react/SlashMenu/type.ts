import type { MenuProps } from '@lobehub/ui';
import type { CSSProperties } from 'react';

import type { MenuRenderProps } from '@/plugins/slash';
import type { FloatMenuProps } from '@/react/FloatMenu';

export interface SlashMenuProps extends MenuRenderProps, Omit<FloatMenuProps, 'children'> {
  classNames?: FloatMenuProps['classNames'] & {
    menu?: string;
  };
  menuProps?: MenuProps;
  styles?: FloatMenuProps['styles'] & {
    menu?: CSSProperties;
  };
}
