'use client';

import { Menu, type MenuProps } from '@lobehub/ui';
import { memo, useCallback } from 'react';

import { ISlashMenuOption } from '@/plugins/slash/service/i-slash-service';

import FloatMenu from '../FloatMenu';
import type { SlashMenuProps } from './type';

const SlashMenu = memo<SlashMenuProps>(
  ({
    options,
    activeKey,
    loading,
    onSelect,
    classNames,
    styles: customStyles,
    menuProps,
    ...floatMenuProps
  }) => {
    const handleMenuClick: MenuProps['onClick'] = useCallback(
      ({ key }: { key: string }) => {
        if (!onSelect) return;
        const option = options.find(
          (item): item is ISlashMenuOption => 'key' in item && item.key === key,
        );
        if (option) onSelect?.(option);
      },
      [options, onSelect],
    );

    return (
      <FloatMenu
        classNames={{
          container: classNames?.container,
          root: classNames?.root,
        }}
        styles={{
          container: customStyles?.container,
          root: customStyles?.root,
        }}
        {...floatMenuProps}
      >
        <Menu
          className={classNames?.menu}
          items={
            loading
              ? [
                  {
                    disabled: true,
                    key: 'loading',
                    label: 'Loading...',
                  },
                ]
              : options
          }
          mode={'inline'}
          onClick={handleMenuClick}
          selectedKeys={activeKey ? [activeKey] : undefined}
          style={customStyles?.menu}
          {...menuProps}
        />
      </FloatMenu>
    );
  },
);

SlashMenu.displayName = 'SlashMenu';

export default SlashMenu;
