'use client';

import { Dropdown, type MenuProps } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { type FC, useCallback } from 'react';

import { ISlashMenuOption } from '../../service/i-slash-service';
import type { SlashMenuProps } from '../type';

const styles = createStaticStyles(({ css }) => ({
  menu: css`
    position: fixed;
    z-index: 9999;
  `,
}));

type DefaultSlashMenuProps = Omit<SlashMenuProps, 'customRender' | 'onActiveKeyChange' | 'editor'>;

const DefaultSlashMenu: FC<DefaultSlashMenuProps> = ({
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
      className={styles.menu}
      style={{
        left: position.x,
        top: position.y,
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

DefaultSlashMenu.displayName = 'DefaultSlashMenu';

export default DefaultSlashMenu;
