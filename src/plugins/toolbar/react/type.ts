import type { CSSProperties, ReactNode } from 'react';

export interface ReactToolbarPluginProps {
  children?: ReactNode;
  className?: string;
  getPopupContainer?: () => HTMLElement | null;
  usePortal?: boolean;
  zIndex?: CSSProperties['zIndex'];
}
