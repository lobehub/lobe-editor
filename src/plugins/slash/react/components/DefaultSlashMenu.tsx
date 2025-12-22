'use client';

import { Dropdown, type MenuProps } from '@lobehub/ui';
import { memo, useCallback } from 'react';

import { ISlashMenuOption } from '../../service/i-slash-service';
import type { SlashMenuProps } from '../type';

type DefaultSlashMenuProps = Omit<SlashMenuProps, 'customRender' | 'onActiveKeyChange' | 'editor'>;

// Keep memo: Menu list rendering with item selection handling
const DefaultSlashMenu = memo<DefaultSlashMenuProps>(
  ({
    activeKey,
    anchorClassName,
    loading,
    onSelect,
    open,
    options,
    position,
    // onClose is passed through but not used directly in this component
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onClose: _onClose,
  }) => {
    const handleMenuClick: MenuProps['onClick'] = useCallback(
      ({ key }: { key: string }) => {
        const option = options.find(
          (item): item is ISlashMenuOption => 'key' in item && item.key === key,
        );
        if (option) onSelect(option);
      },
      [options, onSelect],
    );

    return (
      <div
        style={{
          left: position.x,
          position: 'fixed',
          top: position.y,
          zIndex: 9999,
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
  },
);

DefaultSlashMenu.displayName = 'DefaultSlashMenu';

export default DefaultSlashMenu;
