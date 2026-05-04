'use client';

import { ActionIcon, Flexbox } from '@lobehub/ui';
import { ListTreeIcon, PanelRightCloseIcon } from 'lucide-react';
import { type CSSProperties, type FC, useCallback } from 'react';

import { useOutlineVisibilityToggle } from './OutlineContext';

export interface OutlineToolbarProps {
  className?: string;
  /** Tooltip when the outline is visible (click to hide). */
  collapseTitle?: string;
  /** Tooltip when the outline is hidden (click to show). */
  expandTitle?: string;
  /** @see visible */
  onVisibleChange?: (visible: boolean) => void;
  style?: CSSProperties;
  /**
   * Controlled visibility. Must be used together with {@link OutlineToolbarProps.onVisibleChange}.
   * When omitted, reads/writes {@link OutlineProvider} context.
   */
  visible?: boolean;
}

const defaultCollapseTitle = 'Hide outline';
const defaultExpandTitle = 'Show outline';

/**
 * Toolbar control that toggles outline visibility.
 * Prefer {@link useOutlineActionItem} when merging into a ChatInputActions item list (see toolbar demo).
 *
 * Either wrap the tree with {@link OutlineProvider}, or pass `visible` / `onVisibleChange`
 * together with the same props on {@link OutlinePanel}.
 */
export const OutlineToolbar: FC<OutlineToolbarProps> = ({
  className,
  collapseTitle = defaultCollapseTitle,
  expandTitle = defaultExpandTitle,
  visible: controlledVisible,
  onVisibleChange,
  style,
}) => {
  const controlled =
    controlledVisible !== undefined && onVisibleChange !== undefined
      ? { onVisibleChange, visible: controlledVisible }
      : undefined;

  const toggleApi = useOutlineVisibilityToggle(controlled);

  const handleClick = useCallback(() => {
    if (toggleApi.ready) toggleApi.toggle();
  }, [toggleApi]);

  const canToggle = toggleApi.ready;
  const visible = toggleApi.ready ? toggleApi.visible : false;

  return (
    <Flexbox
      align={'center'}
      className={className}
      data-outline-toolbar={'outline'}
      horizontal
      style={style}
    >
      <ActionIcon
        disabled={!canToggle}
        icon={visible ? PanelRightCloseIcon : ListTreeIcon}
        onClick={handleClick}
        size={{
          blockSize: 36,
          size: 20,
        }}
        title={visible ? collapseTitle : expandTitle}
        tooltipProps={{ placement: 'top' }}
      />
    </Flexbox>
  );
};

OutlineToolbar.displayName = 'OutlineToolbar';
