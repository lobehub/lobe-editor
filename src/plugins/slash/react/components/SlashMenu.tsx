'use client';

import { Dropdown, type MenuProps } from '@lobehub/ui';
import { type FC, useCallback } from 'react';

import { ISlashMenuOption } from '../../service/i-slash-service';
import type { SlashMenuProps } from '../type';

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
  onClose: _onClose,
}) => {
  // Adapter for custom render component onSelect
  const customRenderOnSelect = useCallback(
    (option: ISlashMenuOption) => {
      onSelect(option);
    },
    [onSelect],
  );

  const handleMenuClick: MenuProps['onClick'] = useCallback(
    ({ key }: { key: string }) => {
      const option = options.find(
        (item): item is ISlashMenuOption => 'key' in item && item.key === key,
      );
      if (option) onSelect(option);
    },
    [options, onSelect],
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
    <div
      style={{
        left: position.x,
        position: 'fixed',
        top: position.y,
        zIndex: 1050,
      }}
    >
      <Dropdown
        menu={{
          // @ts-ignore
          activeKey: activeKey,
          items: loading
            ? [
                {
                  disabled: true,
                  key: 'loading',
                  label: 'Loading...',
                },
              ]
            : options,
          onClick: handleMenuClick,
        }}
        open={open}
      >
        <span className={anchorClassName} />
      </Dropdown>
    </div>
  );
};

SlashMenu.displayName = 'SlashMenu';

export default SlashMenu;
