'use client';

import { type FC, type PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';

import { useAnchor } from './useAnchor';

interface PortalAnchorProps {
  anchorElem?: HTMLElement;
}

const PortalAnchor: FC<PropsWithChildren<PortalAnchorProps>> = ({ children }) => {
  const targetElement = useAnchor();

  if (!targetElement) return null;

  return createPortal(children, targetElement);
};

PortalAnchor.displayName = 'PortalAnchor';

export default PortalAnchor;
