'use client';

import {
  autoUpdate,
  flip,
  offset,
  type Placement,
  shift,
  size,
  useFloating,
} from '@floating-ui/react';
import { Icon, LOBE_THEME_APP_ID, menuSharedStyles } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import {
  type FC,
  isValidElement,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';

import {
  flattenSlashOptions,
  type ISlashMenuOption,
  isSlashDividerOption,
  isSlashSectionOption,
} from '../../service/i-slash-service';
import type { SlashMenuProps } from '../type';
import { shouldShowLoadingPlaceholder } from './menuLoading';

const styles = createStaticStyles(({ css, cssVar }) => ({
  compact: css`
    grid-column: span 1;
    justify-content: center;
    min-width: 0;

    > :not(:first-child) {
      display: none;
    }
  `,
  divider: css`
    grid-column: 1 / -1;
  `,
  items: css`
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 4px 6px;
  `,
  menuItem: css`
    box-sizing: border-box;
    width: 100%;
    margin: 0;
  `,
  popup: css`
    scrollbar-width: none;

    overflow-y: auto;

    max-height: min(50vh, 400px);
    padding: 6px;
    border-radius: ${cssVar.borderRadius};

    background: ${cssVar.colorBgElevated};
    outline: none;
    box-shadow:
      0 0 15px 0 #00000008,
      0 2px 30px 0 #00000014,
      0 0 0 1px ${cssVar.colorBorder} inset;

    [role='menuitem'] {
      min-height: 40px;
      padding-block: 8px;
      padding-inline: 12px;
    }
  `,
  popupCaret: css`
    width: max-content;
    min-width: 220px;
  `,
  root: css`
    z-index: 1100;
  `,
  section: css`
    grid-column: 1 / -1;
    margin-block-start: 6px;
  `,
  sectionFirst: css`
    margin-block-start: 0;
  `,
  sectionLabel: css`
    padding-block: 12px 6px;
    padding-inline: 12px;

    font-size: 12px;
    line-height: 1;
    color: ${cssVar.colorTextDescription};

    &:first-child {
      padding-block-start: 6px;
    }
  `,
  text: css`
    overflow: hidden;
    display: flex;
    flex: 1 1 auto;
    gap: 8px;
    align-items: baseline;

    min-width: 0;

    white-space: nowrap;
  `,
  textDescription: css`
    overflow: hidden;
    flex: 1 1 auto;

    min-width: 0;

    color: ${cssVar.colorTextDescription};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  textLabel: css`
    flex: 0 0 auto;
    font-weight: 500;
    color: ${cssVar.colorText};
    white-space: nowrap;
  `,
  tile: css`
    grid-column: span 3;
  `,
  wide: css`
    grid-column: 1 / -1;
  `,
}));

type DefaultSlashMenuProps = Omit<SlashMenuProps, 'customRender' | 'onActiveKeyChange' | 'editor'>;

const renderMenuItem = (
  item: ISlashMenuOption,
  activeKey: string | null,
  onSelect: (option: ISlashMenuOption) => void,
): ReactNode => {
  const isHighlighted = item.key === activeKey;
  const isDisabled = Boolean(item.disabled);
  const description = item.description ?? (item.metadata?.description as ReactNode | undefined);
  const layoutClass = styles[item.layout ?? 'wide'];
  const shortcut = item.shortcut ?? item.extra;

  return (
    <div
      aria-disabled={isDisabled || undefined}
      className={`${menuSharedStyles.item} ${styles.menuItem} ${layoutClass}`}
      data-disabled={isDisabled ? '' : undefined}
      data-highlighted={isHighlighted ? '' : undefined}
      key={String(item.key)}
      onClick={() => {
        if (isDisabled) return;
        onSelect(item);
      }}
      // Prevent the editor from losing focus when the popup is clicked.
      onMouseDown={(event) => event.preventDefault()}
      role={'menuitem'}
    >
      {item.icon ? (
        <span className={menuSharedStyles.icon}>
          {isValidElement(item.icon) ? item.icon : <Icon icon={item.icon} />}
        </span>
      ) : null}
      <span className={styles.text}>
        <span className={styles.textLabel}>{item.label}</span>
        {description ? <span className={styles.textDescription}>{description}</span> : null}
      </span>
      {shortcut ? <span className={menuSharedStyles.extra}>{shortcut}</span> : null}
    </div>
  );
};

const renderItems = (
  options: SlashMenuProps['options'],
  activeKey: string | null,
  loading: boolean | undefined,
  onSelect: (option: ISlashMenuOption) => void,
): ReactNode => {
  // Async searches retain their previous options. Keep rendering those options
  // while the next query is loading instead of flashing a transient placeholder.
  if (shouldShowLoadingPlaceholder(loading, options)) {
    return <div className={menuSharedStyles.empty}>Loading...</div>;
  }
  return (
    <div className={styles.items}>
      {options.map((opt, index) => {
        if (isSlashDividerOption(opt)) {
          return (
            <div
              className={`${menuSharedStyles.separator} ${styles.divider}`}
              key={`__divider_${index}`}
            />
          );
        }
        if (isSlashSectionOption(opt)) {
          return (
            <div
              className={`${styles.section} ${index === 0 ? styles.sectionFirst : ''}`}
              key={String(opt.key ?? `__section_${index}`)}
            >
              <div className={styles.sectionLabel}>{opt.label}</div>
              <div className={styles.items}>
                {opt.items.map((item) => renderMenuItem(item, activeKey, onSelect))}
              </div>
            </div>
          );
        }
        return renderMenuItem(opt, activeKey, onSelect);
      })}
    </div>
  );
};

function useKeepActiveItemVisible(
  open: boolean,
  activeKey: null | string,
  options: SlashMenuProps['options'],
) {
  const popupRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !activeKey) return;
    const popup = popupRef.current;
    const selectedItem = popup?.querySelector<HTMLElement>('[data-highlighted]');
    if (!popup || !selectedItem) return;

    const padding = 8;
    const popupRect = popup.getBoundingClientRect();
    const selectedRect = selectedItem.getBoundingClientRect();
    if (selectedRect.top < popupRect.top + padding) {
      popup.scrollTop -= popupRect.top + padding - selectedRect.top;
    } else if (selectedRect.bottom > popupRect.bottom - padding) {
      popup.scrollTop += selectedRect.bottom - (popupRect.bottom - padding);
    }
  }, [activeKey, open, options]);

  return popupRef;
}

const resolvePortalContainer = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  return document.getElementById(LOBE_THEME_APP_ID) ?? document.body;
};

interface FullWidthSlashMenuProps {
  activeKey: string | null;
  anchor: HTMLElement;
  loading?: boolean;
  onSelect: (option: ISlashMenuOption) => void;
  open: boolean;
  options: SlashMenuProps['options'];
  placement: 'bottom' | 'top';
}

const FullWidthSlashMenu: FC<FullWidthSlashMenuProps> = ({
  activeKey,
  anchor,
  loading,
  onSelect,
  open,
  options,
  placement,
}) => {
  const resolvedPlacement: Placement = placement === 'bottom' ? 'bottom-start' : 'top-start';
  const popupRef = useKeepActiveItemVisible(open, activeKey, options);

  const { refs, floatingStyles, isPositioned } = useFloating({
    elements: { reference: anchor },
    middleware: [
      offset(8),
      size({
        apply({ rects, elements }) {
          elements.floating.style.width = `${rects.reference.width}px`;
        },
      }),
      flip({ fallbackPlacements: placement === 'bottom' ? ['top-start'] : ['bottom-start'] }),
      shift({ padding: 8 }),
    ],
    open,
    placement: resolvedPlacement,
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
  });

  const portalContainer = resolvePortalContainer();
  if (!portalContainer) return null;

  return createPortal(
    <div
      className={styles.root}
      data-resolved-placement={resolvedPlacement}
      ref={refs.setFloating}
      style={{ ...floatingStyles, visibility: isPositioned ? 'visible' : 'hidden' }}
    >
      <div className={styles.popup} ref={popupRef}>
        {renderItems(options, activeKey, loading, onSelect)}
      </div>
    </div>,
    portalContainer,
  );
};

interface CaretSlashMenuProps {
  activeKey: string | null;
  loading?: boolean;
  onSelect: (option: ISlashMenuOption) => void;
  open: boolean;
  options: SlashMenuProps['options'];
  placement?: 'bottom' | 'top';
  position: NonNullable<SlashMenuProps['position']>;
}

const CaretSlashMenu: FC<CaretSlashMenuProps> = ({
  activeKey,
  loading,
  onSelect,
  open,
  options,
  placement: forcePlacement,
  position,
}) => {
  const resolvedPlacement: Placement = forcePlacement ? `${forcePlacement}-start` : 'top-start';
  const popupRef = useKeepActiveItemVisible(open, activeKey, options);

  const middleware = useMemo(
    () => [offset(8), ...(!forcePlacement ? [flip()] : []), shift({ padding: 8 })],
    [forcePlacement],
  );

  const getRectRef = useRef(position.getRect);
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

  useEffect(() => {
    if (!open || !position.rect) return;
    const frame = requestAnimationFrame(() => update());
    return () => cancelAnimationFrame(frame);
  }, [open, position.rect, update]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => update();
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [open, update]);

  const portalContainer = resolvePortalContainer();
  if (!portalContainer) return null;

  return createPortal(
    <div
      className={`${styles.root} ${styles.popupCaret}`}
      data-resolved-placement={resolvedPlacement}
      ref={refs.setFloating}
      style={{ ...floatingStyles, visibility: isPositioned ? 'visible' : 'hidden' }}
    >
      <div className={styles.popup} ref={popupRef}>
        {renderItems(options, activeKey, loading, onSelect)}
      </div>
    </div>,
    portalContainer,
  );
};

const DefaultSlashMenu: FC<DefaultSlashMenuProps> = ({
  activeKey,
  getPopupContainer,
  loading,
  onSelect,
  open,
  options,
  placement,
  position,
}) => {
  const hasVisibleItems = flattenSlashOptions(options).length > 0;
  if (!open || !hasVisibleItems) return null;

  const anchor = getPopupContainer?.() ?? null;

  if (anchor) {
    return (
      <FullWidthSlashMenu
        activeKey={activeKey}
        anchor={anchor}
        loading={loading}
        onSelect={onSelect}
        open={open}
        options={options}
        placement={placement ?? 'top'}
      />
    );
  }

  if (!position) return null;

  return (
    <CaretSlashMenu
      activeKey={activeKey}
      loading={loading}
      onSelect={onSelect}
      open={open}
      options={options}
      placement={placement}
      position={position}
    />
  );
};

DefaultSlashMenu.displayName = 'DefaultSlashMenu';

export default DefaultSlashMenu;
