import type { CSSProperties } from 'react';

import { MenuRenderProps } from '@/plugins/slash';

export interface SlashMenuProps extends MenuRenderProps {
  className?: string;
  getPopupContainer: () => HTMLDivElement | null;
  maxHeight?: string | number;
  style?: CSSProperties;
}
