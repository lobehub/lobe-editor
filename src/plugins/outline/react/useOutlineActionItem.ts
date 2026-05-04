'use client';

import { ListTreeIcon, PanelRightCloseIcon } from 'lucide-react';
import { useMemo } from 'react';

import type { ChatInputActionItem } from '@/react/ChatInputActions/type';

import type { OutlineControlledVisibilityProps } from './OutlineContext';
import { useOutlineVisibilityToggle } from './OutlineContext';

export interface UseOutlineActionItemProps extends OutlineControlledVisibilityProps {
  /** Tooltip when outline is expanded (click to collapse). */
  collapseTitle?: string;
  /** Tooltip when outline is hidden (click to expand). */
  expandTitle?: string;
}

const defaultCollapseTitle = 'Hide outline';
const defaultExpandTitle = 'Show outline';

const outlineActionKey = 'outline';

/**
 * Returns a {@link ChatInputActions} toolbar item that toggles outline visibility
 * via {@link OutlineProvider} or `visible` + `onVisibleChange`.
 * Returns `null` when no provider/control is configured — omit from `items`.
 */
export function useOutlineActionItem(
  props?: UseOutlineActionItemProps,
): ChatInputActionItem | null {
  const {
    collapseTitle = defaultCollapseTitle,
    expandTitle = defaultExpandTitle,
    onVisibleChange,
    visible: controlledVisible,
  } = props ?? {};

  const controlled: OutlineControlledVisibilityProps | undefined =
    controlledVisible !== undefined && onVisibleChange !== undefined
      ? { onVisibleChange, visible: controlledVisible }
      : undefined;

  const toggleApi = useOutlineVisibilityToggle(controlled);

  return useMemo(() => {
    if (!toggleApi.ready) return null;

    const { toggle, visible } = toggleApi;

    return {
      active: visible,
      icon: visible ? PanelRightCloseIcon : ListTreeIcon,
      key: outlineActionKey,
      label: visible ? collapseTitle : expandTitle,
      onClick: toggle,
    };
  }, [collapseTitle, expandTitle, toggleApi]);
}
