'use client';

import { type Placement, flip, offset, shift, useFloating } from '@floating-ui/react';
import { Menu, type MenuProps } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { type FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import { ISlashMenuOption } from '../../service/i-slash-service';
import type { SlashMenuProps } from '../type';

const LOBE_THEME_APP_ID = 'lobe-ui-theme-app';

const styles = createStaticStyles(({ css, cssVar }) => ({
  menu: css`
    z-index: 9999;
    width: max-content;
  `,
  popup: css`
    scrollbar-width: none;

    overflow-y: auto;

    min-width: 120px;
    max-height: min(50vh, 400px);
    padding: 4px;
    border-radius: ${cssVar.borderRadius};

    background: ${cssVar.colorBgElevated};
    outline: none;
    box-shadow:
      0 0 15px 0 #00000008,
      0 2px 30px 0 #00000014,
      0 0 0 1px ${cssVar.colorBorder} inset;

    .ant-menu {
      min-width: 200px;
      padding: 0 !important;
      border-inline-end: none !important;

      color: ${cssVar.colorText} !important;

      background: transparent !important;
      background-color: transparent !important;
    }

    .ant-menu-item {
      overflow: hidden;
      display: flex !important;
      align-items: center;

      width: 100% !important;
      min-height: 36px;
      margin: 0 !important;
      padding-block: 8px !important;
      padding-inline: 12px !important;
      border-radius: ${cssVar.borderRadiusSM} !important;

      font-size: 14px;
      line-height: 20px;
      color: ${cssVar.colorText} !important;

      background: transparent !important;

      transition: all 150ms ${cssVar.motionEaseOut};

      &:hover,
      &.ant-menu-item-active {
        background: ${cssVar.colorFillTertiary} !important;
      }

      &:active {
        background: ${cssVar.colorFillSecondary} !important;
      }
    }

    .ant-menu-item-divider {
      height: 1px;
      margin-block: 4px !important;
      margin-inline: 0 !important;
      background: ${cssVar.colorBorder} !important;
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
}) => {
  const resolvedPlacement: Placement = forcePlacement ? `${forcePlacement}-start` : 'top-start';

  const middleware = useMemo(
    () => [offset(8), ...(!forcePlacement ? [flip()] : []), shift({ padding: 8 })],
    [forcePlacement],
  );

  // Keep getRect in a ref so the virtual reference always calls the latest version
  const getRectRef = useRef(position.getRect);
  getRectRef.current = position.getRect;

  const { refs, floatingStyles, update } = useFloating({
    middleware,
    open,
    placement: resolvedPlacement,
    strategy: 'fixed',
  });

  useLayoutEffect(() => {
    if (!position.rect) return;
    refs.setPositionReference({
      getBoundingClientRect: () => getRectRef.current?.() ?? position.rect!,
    });
  }, [position.rect, refs]);

  // Listen to scroll events to update floating position.
  // capture phase on window catches scroll from any ancestor (scroll events don't bubble,
  // but do propagate during capture). Also listen on getPopupContainer for edge cases
  // like shadow DOM where capture on window may not reach.
  useEffect(() => {
    if (!open) return;

    const onScroll = () => update();
    const container = getPopupContainer?.();

    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    if (container) {
      container.addEventListener('scroll', onScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      if (container) {
        container.removeEventListener('scroll', onScroll);
      }
    };
  }, [open, getPopupContainer, update]);

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
      <div className={styles.popup}>
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
      </div>
    </div>
  );

  return createPortal(node, portalContainer);
};

DefaultSlashMenu.displayName = 'DefaultSlashMenu';

export default DefaultSlashMenu;
