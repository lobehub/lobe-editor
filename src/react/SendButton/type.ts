import type { ButtonProps, DropdownItem, DropdownMenuProps } from '@lobehub/ui/base-ui';
import type { CSSProperties, MouseEvent } from 'react';

export type SendButtonClickHandler = (e: MouseEvent<HTMLElement>) => void;

export interface SendButtonProps {
  className?: string;
  disabled?: boolean;
  generating?: boolean;
  loading?: boolean;
  menu?: { items: DropdownItem[] };
  onClick?: SendButtonClickHandler;
  onSend?: SendButtonClickHandler;
  onStop?: SendButtonClickHandler;
  placement?: DropdownMenuProps['placement'];
  shape?: 'default' | 'round';
  size?: number;
  style?: CSSProperties;
  title?: string;
  trigger?: DropdownMenuProps['trigger'];
  type?: ButtonProps['type'];
}
