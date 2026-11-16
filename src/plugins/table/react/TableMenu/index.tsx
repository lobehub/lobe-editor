import { cx, LOBE_THEME_APP_ID } from '@lobehub/ui';
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon } from 'lucide-react';
import { type CSSProperties, memo, type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { ITableControllerMenuItem, ITableControllerMenuRenderContext } from '../../service';
import { styles } from './style';

export type TableMenuPlacement = 'bottom' | 'bottomStart' | 'right';

interface TableMenuProps {
  anchor: HTMLElement;
  context: ITableControllerMenuRenderContext;
  items: ITableControllerMenuItem[];
  onClose: () => void;
  placement: TableMenuPlacement;
}

const GAP = 6;

const OPTION_ICONS: Record<string, ReactNode> = {
  'align-center': <AlignCenterIcon size={14} />,
  'align-left': <AlignLeftIcon size={14} />,
  'align-right': <AlignRightIcon size={14} />,
};

const getContainer = () =>
  (document.querySelector(`#${LOBE_THEME_APP_ID}`) as HTMLElement | null) || document.body;

const position = (anchor: HTMLElement, menu: HTMLElement | null, placement: TableMenuPlacement) => {
  const rect = anchor.getBoundingClientRect();
  const width = menu?.offsetWidth ?? 200;
  const height = menu?.offsetHeight ?? 0;
  const clamp = (value: number, max: number) => Math.min(Math.max(value, GAP), Math.max(GAP, max));
  const top = placement === 'right' ? rect.top : rect.bottom + GAP;
  const left = {
    bottom: rect.left + rect.width / 2 - width / 2,
    bottomStart: rect.left,
    right: rect.right + GAP,
  }[placement];
  return {
    insetBlockStart: clamp(top, window.innerHeight - height - GAP),
    insetInlineStart: clamp(left, window.innerWidth - width - GAP),
  } satisfies CSSProperties;
};

const TableMenu = memo<TableMenuProps>(({ anchor, context, items, onClose, placement }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>(() => position(anchor, null, placement));

  useLayoutEffect(() => {
    const update = () => setStyle(position(anchor, menuRef.current, placement));
    update();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (menuRef.current?.contains(target) || anchor.contains(target))) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchor, onClose, placement]);

  const run = (action: (ctx: ITableControllerMenuRenderContext) => void) => {
    action(context);
    onClose();
  };

  const keepSelection = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return createPortal(
    <div
      className={styles.menu}
      contentEditable={false}
      onMouseDown={keepSelection}
      ref={menuRef}
      role="menu"
      style={style}
    >
      {items.map((item) => {
        switch (item.type) {
          case 'separator': {
            return <div className={styles.separator} key={item.key} role="separator" />;
          }
          case 'label': {
            return (
              <div className={styles.label} key={item.key}>
                {item.label}
              </div>
            );
          }
          case 'segmented': {
            return (
              <div className={styles.segmented} key={item.key} role="group">
                {item.options.map((option) => (
                  <button
                    aria-label={option.label}
                    aria-pressed={Boolean(option.active?.(context))}
                    className={styles.segment}
                    key={option.key}
                    onClick={() => run(option.onClick)}
                    title={option.label}
                    type="button"
                  >
                    {option.icon ?? OPTION_ICONS[option.key] ?? option.label}
                  </button>
                ))}
              </div>
            );
          }
          default: {
            const label = typeof item.label === 'function' ? item.label(context) : item.label;
            return (
              <button
                aria-label={label}
                className={cx(styles.item, item.danger && styles.itemDanger)}
                key={item.key}
                onClick={() => run(item.onClick)}
                role="menuitem"
                type="button"
              >
                {item.icon}
                {label}
              </button>
            );
          }
        }
      })}
    </div>,
    getContainer(),
  );
});

TableMenu.displayName = 'TableMenu';

export default TableMenu;
