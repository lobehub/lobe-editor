'use client';

import { type FC, useCallback } from 'react';

import { ISlashMenuOption } from '../../service/i-slash-service';
import type { SlashMenuProps } from '../type';
import DefaultSlashMenu from './DefaultSlashMenu';

/**
 * SlashMenu component - Only responsible for rendering the menu UI
 * All state management and plugin registration is handled by ReactSlashPlugin
 */
const SlashMenu: FC<SlashMenuProps> = ({
  activeKey,
  anchorClassName,
  customRender: CustomRender,
  loading,
  onActiveKeyChange,
  onSelect,
  open,
  options,
  position,
  // onClose is passed through but not used directly in this component
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onClose,
}) => {
  // Adapter for custom render component onSelect
  const customRenderOnSelect = useCallback(
    (option: ISlashMenuOption) => {
      onSelect(option);
    },
    [onSelect],
  );

  /**
   * Render the custom component if it exists
   */
  if (CustomRender) {
    return (
      <CustomRender
        activeKey={activeKey}
        loading={loading}
        onSelect={customRenderOnSelect}
        open={open}
        options={options}
        setActiveKey={onActiveKeyChange}
      />
    );
  }

  return (
    <DefaultSlashMenu
      activeKey={activeKey}
      anchorClassName={anchorClassName}
      loading={loading}
      onClose={onClose}
      onSelect={onSelect}
      open={open}
      options={options}
      position={position}
    />
  );
};

SlashMenu.displayName = 'SlashMenu';

export default SlashMenu;
