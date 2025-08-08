import type { DropdownButtonProps } from 'antd/lib/dropdown';

export interface SendButtonProps extends Omit<DropdownButtonProps, 'children' | 'icon' | 'size'> {
  generating?: boolean;
  shape?: 'default' | 'round';
  size?: number;
}
