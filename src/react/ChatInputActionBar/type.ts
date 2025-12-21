import type { FlexboxProps } from '@lobehub/ui';
import type { ReactNode } from 'react';

export interface ChatInputActionBarProps extends Omit<FlexboxProps, 'children'> {
  left?: ReactNode;
  right?: ReactNode;
}
