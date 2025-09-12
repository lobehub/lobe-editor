'use client';

import { PropsWithChildren, memo } from 'react';
import { createPortal } from 'react-dom';

import { useAnchor } from './useAnchor';

const PortalAnchor = memo<PropsWithChildren<{ anchorElem?: HTMLElement }>>(({ children }) => {
  const targetElement = useAnchor();

  if (!targetElement) return null;

  return createPortal(children, targetElement);
});

PortalAnchor.displayName = 'PortalAnchor';

export default PortalAnchor;
