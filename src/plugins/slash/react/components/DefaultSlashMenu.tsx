'use client';

import { type Placement, autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import { Block, Menu, type MenuProps } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { type FC, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { ISlashMenuOption } from '../../service/i-slash-service';
import type { SlashMenuProps } from '../type';

const LOBE_THEME_APP_ID = 'lobe-ui-theme-app';

const styles = createStaticStyles(({ css }) => ({
  container: css`
    overflow-y: auto;
    max-height: min(50vh, 400px);

    .ant-menu {
      min-width: 200px;
    }

    .ant-menu-item {
      display: flex;
      align-items: center;
    }

    .ant-menu-item-active {
      background-color: var(--ant-menu-item-hover-bg) !important;
    }

    .ant-menu-title-content,
    .ant-menu-title-content-with-extra {
      overflow: visible;
      display: inline-flex;
      gap: 24px;
      justify-content: space-between;

      width: 100%;

      text-overflow: unset;
    }
  `,
  menu: css`
    z-index: 9999;
    width: max-content;
  `,
}));

type DefaultSlashMenuProps = Omit<SlashMenuProps, 'customRender' | 'onActiveKeyChange' | 'editor'>;

const DefaultSlashMenu: FC<DefaultSlashMenuProps> = ({
  activeKey,
  getPopupContainer,
  loading,
  onSelect,
  open,
  options,
  placement: forcePlacement,
  position,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onClose: _onClose,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  anchorClassName: _anchorClassName,
}) => {
  const resolvedPlacement: Placement = forcePlacement ? `${forcePlacement}-start` : 'top-start';

  const middleware = useMemo(
    () => [offset(8), ...(!forcePlacement ? [flip()] : []), shift({ padding: 8 })],
    [forcePlacement],
  );

  const { refs, floatingStyles, update } = useFloating({
    middleware,
    open,
    placement: resolvedPlacement,
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
  });

  useLayoutEffect(() => {
    if (!position.rect) return;
    refs.setPositionReference({
      getBoundingClientRect: () => position.rect!,
    });
  }, [position.rect, refs]);

  // Listen to scroll events on the custom container to update position
  useEffect(() => {
    const container = getPopupContainer?.();
    if (!container || !open) return;

    const onScroll = () => update();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [getPopupContainer, open, update]);

  const handleMenuClick: MenuProps['onClick'] = useCallback(
    ({ key }: { key: string }) => {
      const option = options.find(
        (item): item is ISlashMenuOption => 'key' in item && item.key === key,
      );
      if (option) onSelect(option);
    },
    [options, onSelect],
  );

  if (!open) return null;

  const portalContainer =
    getPopupContainer?.() || document.getElementById(LOBE_THEME_APP_ID) || document.body;

  const node = (
    <div className={styles.menu} ref={refs.setFloating} style={floatingStyles}>
      <Block className={styles.container} shadow variant={'outlined'}>
        <Menu
          // @ts-ignore - activeKey is a valid antd Menu prop passed via ...rest
          activeKey={activeKey}
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
          onClick={handleMenuClick}
          selectable={false}
        />
      </Block>
    </div>
  );

  return createPortal(node, portalContainer);
};

DefaultSlashMenu.displayName = 'DefaultSlashMenu';

export default DefaultSlashMenu;
