import type { ReactNode } from 'react';
import { FlexboxProps } from 'react-layout-kit';

export interface ChatInputActionBarProps extends Omit<FlexboxProps, 'children'> {
  left?: ReactNode;
  right?: ReactNode;
}
