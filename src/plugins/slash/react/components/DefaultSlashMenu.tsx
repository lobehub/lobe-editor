'use client';

import { type Placement, flip, offset, shift, useFloating } from '@floating-ui/react';
import { Icon, Menu, type MenuProps } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { type FC, isValidElement, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import { ISlashMenuOption } from '../../service/i-slash-service';
import { isSlashDividerOption, isSlashMenuOption } from '../menu-utils';
import type { SlashMenuProps } from '../type';

const LOBE_THEME_APP_ID = 'lobe-ui-theme-app';

const styles = createStaticStyles(({ css, cssVar }) => ({
  menu: css`
    display: grid !important;
    grid-template-columns: repeat(6, 36px);
    gap: 4px 6px;

    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;

    list-style: none !important;

    background: transparent !important;

    &::before,
    &::after {
      content: none !important;
      display: none !important;
    }

    .ant-menu-item,
    .ant-menu-submenu-title {
      display: flex !important;
      grid-column: 1 / -1;
      align-items: center !important;

      box-sizing: border-box;
      width: 100% !important;
      height: 36px !important;
      min-height: 36px;
      margin-block: 0 !important;
      margin-inline: 0 !important;
      padding-block: 0 !important;
      padding-inline: 8px !important;
      border-radius: 8px !important;

      line-height: normal !important;
    }

    .ant-menu-item-selected {
      background: ${cssVar.colorFillSecondary} !important;
    }

    .ant-menu-title-content {
      min-width: 0;
    }

    .ant-menu-item-divider {
      position: relative;

      grid-column: 1 / -1;

      width: 100% !important;
      height: 9px !important;
      min-height: 0 !important;
      margin-block: 4px !important;
      margin-inline: 0 !important;
      padding: 0 !important;
      border: 0 !important;

      background: transparent !important;
    }

    .ant-menu-item-divider::after {
      content: '';

      position: absolute;
      inset-block-start: 50%;
      inset-inline: 0;
      transform: translateY(-50%);

      height: 1px;

      background: ${cssVar.colorSplit};
    }

    .lobe-slash-menu-item-compact {
      display: inline-flex !important;
      grid-column: span 1;
      align-items: center;
      justify-content: center;
      justify-self: center;

      width: 36px !important;
      min-width: 0;
      height: 36px !important;
      min-height: 36px;
      padding-inline: 0 !important;
    }

    .lobe-slash-menu-item-compact .ant-menu-title-content {
      display: inline-flex;
      justify-content: center;
    }

    .lobe-slash-menu-item-compact .lobe-slash-menu-item-inner {
      gap: 0;
      justify-content: center;
    }

    .lobe-slash-menu-item-compact .lobe-slash-menu-item-content,
    .lobe-slash-menu-item-compact .lobe-slash-menu-item-extra {
      display: none;
    }

    .lobe-slash-menu-item-compact .lobe-slash-menu-item-icon {
      width: 28px;
      height: 28px;
      border: 0;
      background: transparent;
    }

    .lobe-slash-menu-item-tile {
      grid-column: span 3;
      height: 36px !important;
      min-height: 36px;
    }

    .lobe-slash-menu-item-tile .lobe-slash-menu-item-extra {
      display: none;
    }

    .lobe-slash-menu-item-wide {
      grid-column: 1 / -1;
      height: 36px !important;
      min-height: 36px;
    }
  `,
  menuItem: css`
    display: flex;
    gap: 10px;
    align-items: center;

    width: 100%;
    min-width: 0;
    height: 100%;
  `,
  menuItemContent: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;

    min-width: 0;
  `,
  menuItemDesc: css`
    overflow: hidden;

    font-size: 12px;
    line-height: 20px;
    color: ${cssVar.colorTextTertiary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  menuItemExtra: css`
    flex: none;

    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
    line-height: 20px;
    color: ${cssVar.colorTextTertiary};
  `,
  menuItemIcon: css`
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;

    width: 28px;
    height: 28px;
    border: 0;

    color: ${cssVar.colorTextSecondary};

    background: transparent;
  `,
  menuItemLabel: css`
    overflow: hidden;

    font-size: 14px;
    line-height: 20px;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  popup: css`
    scrollbar-width: none;

    overflow: hidden auto;

    min-width: 0;
    max-height: min(70vh, 520px);
    padding: 8px;
    border: 1px solid ${cssVar.colorBorder};
    border-radius: 12px;

    background: ${cssVar.colorBgElevated};
    outline: none;
    box-shadow:
      0 0 15px 0 #00000008,
      0 2px 30px 0 #00000014,
      0 0 0 1px ${cssVar.colorBorder} inset;
  `,
  root: css`
    z-index: 1100;
    width: max-content;
  `,
}));

type DefaultSlashMenuProps = Omit<SlashMenuProps, 'customRender' | 'onActiveKeyChange' | 'editor'>;

function renderItemIcon(icon: ISlashMenuOption['icon']) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;

  return <Icon icon={icon as never} />;
}

function renderItemLabel(item: ISlashMenuOption) {
  const description = item.description ?? item.desc;
  const icon = renderItemIcon(item.icon);
  const shortcut = item.shortcut ?? item.extra;

  return (
    <span className={`${styles.menuItem} lobe-slash-menu-item-inner`}>
      {icon ? (
        <span className={`${styles.menuItemIcon} lobe-slash-menu-item-icon`}>{icon}</span>
      ) : null}
      <span className={`${styles.menuItemContent} lobe-slash-menu-item-content`}>
        <span className={styles.menuItemLabel}>{item.label}</span>
        {description ? <span className={styles.menuItemDesc}>{description}</span> : null}
      </span>
      {shortcut ? (
        <span className={`${styles.menuItemExtra} lobe-slash-menu-item-extra`}>{shortcut}</span>
      ) : null}
    </span>
  );
}

function toMenuItems(options: SlashMenuProps['options']): MenuProps['items'] {
  return options.map((option, index) => {
    if (isSlashDividerOption(option)) {
      return { key: `__divider_${index}`, type: 'divider' };
    }

    const item = option as ISlashMenuOption;
    return {
      className: item.layout ? `lobe-slash-menu-item-${item.layout}` : undefined,
      danger: item.danger,
      disabled: item.disabled,
      key: String(item.key),
      label: renderItemLabel(item),
    };
  });
}

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
  const popupRef = useRef<HTMLDivElement>(null);
  getRectRef.current = position.getRect;

  const { refs, floatingStyles, isPositioned, update } = useFloating({
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

  // Force position recalculation after reference is set.
  // useFloating computes before useLayoutEffect sets the reference,
  // so the first frame has wrong position. rAF ensures a correct update.
  useEffect(() => {
    if (!open || !position.rect) return;
    const frame = requestAnimationFrame(() => update());
    return () => cancelAnimationFrame(frame);
  }, [open, position.rect, update]);

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

  useLayoutEffect(() => {
    if (!open || !activeKey) return;

    const popup = popupRef.current;
    const selectedItem = popup?.querySelector<HTMLElement>('.ant-menu-item-selected');
    if (!popup || !selectedItem) return;

    const padding = 8;
    const popupRect = popup.getBoundingClientRect();
    const selectedRect = selectedItem.getBoundingClientRect();
    const minTop = popupRect.top + padding;
    const maxBottom = popupRect.bottom - padding;

    if (selectedRect.top < minTop) {
      popup.scrollTop -= minTop - selectedRect.top;
      return;
    }

    if (selectedRect.bottom > maxBottom) {
      popup.scrollTop += selectedRect.bottom - maxBottom;
    }
  }, [activeKey, open, options]);

  const hasVisibleItems = options?.some((item) => !isSlashDividerOption(item));
  if (!open || !hasVisibleItems) return null;

  const portalContainer =
    getPopupContainer?.() || document.getElementById(LOBE_THEME_APP_ID) || document.body;

  const menuItems: MenuProps['items'] = loading
    ? [{ disabled: true, key: '__loading', label: 'Loading...' }]
    : toMenuItems(options);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    const item = options.find(
      (option): option is ISlashMenuOption =>
        isSlashMenuOption(option) && String(option.key) === String(key),
    );
    if (!item || item.disabled) return;

    onSelect(item);
  };

  const node = (
    <div
      className={styles.root}
      data-resloved-placement={resolvedPlacement}
      ref={refs.setFloating}
      // Hide until floating-ui has measured to avoid a one-frame flash at 0,0
      // on first open (the layout effect attaches the reference *after* the
      // initial render, so the first floatingStyles fall back to top-left).
      style={{ ...floatingStyles, visibility: isPositioned ? 'visible' : 'hidden' }}
    >
      <div className={styles.popup} onMouseDown={(event) => event.preventDefault()} ref={popupRef}>
        <Menu
          className={styles.menu}
          items={menuItems}
          mode="inline"
          onClick={handleMenuClick}
          selectedKeys={activeKey ? [activeKey] : undefined}
        />
      </div>
    </div>
  );

  return createPortal(node, portalContainer);
};

DefaultSlashMenu.displayName = 'DefaultSlashMenu';

export default DefaultSlashMenu;
