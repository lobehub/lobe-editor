import type { DropdownButtonProps } from 'antd/lib/dropdown';

export interface SendButtonProps extends Omit<DropdownButtonProps, 'children' | 'icon' | 'size'> {
  shape?: 'default' | 'round';
  size?: number;
}
