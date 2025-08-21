import type { CSSProperties, ReactNode, Ref } from 'react';
import { FlexboxProps } from 'react-layout-kit';

export interface ChatInputProps extends FlexboxProps {
  classNames?: {
    body?: string;
  };
  footer?: ReactNode;
  fullscreen?: boolean;
  header?: ReactNode;
  maxHeight?: string | number;
  slashMenuRef?: Ref<HTMLDivElement>;
  styles?: {
    body?: CSSProperties;
  };
}
