import { cx } from 'antd-style';
import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { styles } from './TableController/style';

interface TableControllerMenuActionItem {
  danger?: boolean;
  key: string;
  label: string;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

interface TableControllerMenuSeparatorItem {
  key: string;
  type: 'separator';
}

export type TableControllerMenuItem =
  | TableControllerMenuActionItem
  | TableControllerMenuSeparatorItem;

interface TableControllerMenuProps {
  anchorElement: HTMLElement | null;
  items: TableControllerMenuItem[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  position: 'left' | 'top';
}

const MENU_GAP = 8;
const MENU_MIN_WIDTH = 168;

const isSeparatorItem = (
  item: TableControllerMenuItem,
): item is TableControllerMenuSeparatorItem => {
  return 'type' in item && item.type === 'separator';
};

const getPortalContainer = () => {
  if (typeof document === 'undefined') {
    return null;
  }

  return (document.querySelector('.ant-app') as HTMLElement | null) || document.body;
};

const getMenuStyle = (
  anchorElement: HTMLElement | null,
  items: TableControllerMenuItem[],
  position: TableControllerMenuProps['position'],
  menuElement?: HTMLElement | null,
) => {
  if (!anchorElement || typeof window === 'undefined') {
    return {};
  }

  const rect = anchorElement.getBoundingClientRect();
  const menuWidth = MENU_MIN_WIDTH;
  const estimatedHeight =
    menuElement?.getBoundingClientRect().height ||
    items.reduce((height, item) => height + (isSeparatorItem(item) ? 9 : 32), 12);
  const maxLeft = Math.max(MENU_GAP, window.innerWidth - menuWidth - MENU_GAP);
  const maxTop = Math.max(MENU_GAP, window.innerHeight - estimatedHeight - MENU_GAP);
  const clamp = (value: number, max: number) => Math.min(Math.max(value, MENU_GAP), max);

  if (position === 'top') {
    const preferredTop = rect.top - estimatedHeight - MENU_GAP;
    const fallbackTop = rect.bottom + MENU_GAP;

    return {
      insetBlockStart: preferredTop >= MENU_GAP ? preferredTop : clamp(fallbackTop, maxTop),
      insetInlineStart: clamp(rect.left + rect.width / 2 - menuWidth / 2, maxLeft),
      minInlineSize: menuWidth,
    };
  }

  const preferredLeft = rect.left - menuWidth - MENU_GAP;
  const fallbackLeft = rect.right + MENU_GAP;

  return {
    insetBlockStart: clamp(rect.top + rect.height / 2 - estimatedHeight / 2, maxTop),
    insetInlineStart: preferredLeft >= MENU_GAP ? preferredLeft : clamp(fallbackLeft, maxLeft),
    minInlineSize: menuWidth,
  };
};

const TableControllerMenu = memo<TableControllerMenuProps>(
  ({ anchorElement, items, onOpenChange, open, position }) => {
    const [style, setStyle] = useState(() => getMenuStyle(anchorElement, items, position));
    const menuRef = useRef<HTMLDivElement | null>(null);
    const container = getPortalContainer();

    useEffect(() => {
      if (!open || !anchorElement) {
        return;
      }

      const updateStyle = () => {
        setStyle(getMenuStyle(anchorElement, items, position, menuRef.current));
      };

      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target;
        if (
          target instanceof Node &&
          (anchorElement.contains(target) || menuRef.current?.contains(target))
        ) {
          return;
        }

        onOpenChange(false);
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onOpenChange(false);
        }
      };

      updateStyle();
      requestAnimationFrame(updateStyle);
      window.addEventListener('scroll', updateStyle, true);
      window.addEventListener('resize', updateStyle);
      document.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown);

      const observer = new ResizeObserver(updateStyle);
      observer.observe(anchorElement);

      return () => {
        window.removeEventListener('scroll', updateStyle, true);
        window.removeEventListener('resize', updateStyle);
        document.removeEventListener('pointerdown', handlePointerDown);
        document.removeEventListener('keydown', handleKeyDown);
        observer.disconnect();
      };
    }, [anchorElement, container, items, onOpenChange, open, position]);

    if (!container || !open) {
      return null;
    }

    return createPortal(
      <div className={styles.menu} contentEditable={false} ref={menuRef} role="menu" style={style}>
        {items.map((item) => {
          if (isSeparatorItem(item)) {
            return <div className={styles.menuSeparator} key={item.key} role="separator" />;
          }

          return (
            <button
              className={cx(styles.menuItem, item.danger && styles.menuItemDanger)}
              key={item.key}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                item.onClick();
                onOpenChange(false);
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onMouseEnter={item.onMouseEnter}
              onMouseLeave={item.onMouseLeave}
              role="menuitem"
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>,
      container,
    );
  },
);

TableControllerMenu.displayName = 'TableControllerMenu';

export default TableControllerMenu;
