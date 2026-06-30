'use client';

import {
  type Placement,
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
} from '@floating-ui/react';
import { Icon, LOBE_THEME_APP_ID, menuSharedStyles } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { type FC, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import {
  type ISlashMenuOption,
  flattenSlashOptions,
  isSlashDividerOption,
  isSlashSectionOption,
} from '../../service/i-slash-service';
import type { SlashMenuProps } from '../type';

const styles = createStaticStyles(({ css, cssVar }) => ({
  popup: css`
    scrollbar-width: none;

    overflow-y: auto;

    max-height: min(50vh, 400px);
    padding: 4px;
    border-radius: ${cssVar.borderRadius};

    background: ${cssVar.colorBgElevated};
    outline: none;
    box-shadow:
      0 0 15px 0 #00000008,
      0 2px 30px 0 #00000014,
      0 0 0 1px ${cssVar.colorBorder} inset;
  `,
  popupCaret: css`
    width: max-content;
    min-width: 200px;
  `,
  root: css`
    z-index: 1100;
  `,
  section: css`
    margin-block-start: 4px;
  `,
  sectionFirst: css`
    margin-block-start: 0;
  `,
  sectionLabel: css`
    padding-block: 12px 6px;
    padding-inline: 8px;

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
}));

type DefaultSlashMenuProps = Omit<SlashMenuProps, 'customRender' | 'onActiveKeyChange' | 'editor'>;

const renderMenuItem = (
  item: ISlashMenuOption,
  activeKey: string | null,
  onSelect: (option: ISlashMenuOption) => void,
): ReactNode => {
  const isHighlighted = item.key === activeKey;
  const isDisabled = Boolean(item.disabled);
  const description = item.metadata?.description as ReactNode | undefined;

  return (
    <div
      aria-disabled={isDisabled || undefined}
      className={menuSharedStyles.item}
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
          <Icon icon={item.icon} />
        </span>
      ) : null}
      <span className={styles.text}>
        <span className={styles.textLabel}>{item.label}</span>
        {description ? <span className={styles.textDescription}>{description}</span> : null}
      </span>
      {item.extra ? <span className={menuSharedStyles.extra}>{item.extra}</span> : null}
    </div>
  );
};

const renderItems = (
  options: SlashMenuProps['options'],
  activeKey: string | null,
  loading: boolean | undefined,
  onSelect: (option: ISlashMenuOption) => void,
): ReactNode => {
  if (loading) return <div className={menuSharedStyles.empty}>Loading...</div>;
  return options.map((opt, index) => {
    if (isSlashDividerOption(opt)) {
      return <div className={menuSharedStyles.separator} key={`__divider_${index}`} />;
    }
    if (isSlashSectionOption(opt)) {
      return (
        <div
          className={`${styles.section} ${index === 0 ? styles.sectionFirst : ''}`}
          key={String(opt.key ?? `__section_${index}`)}
        >
          <div className={styles.sectionLabel}>{opt.label}</div>
          {opt.items.map((item) => renderMenuItem(item, activeKey, onSelect))}
        </div>
      );
    }
    return renderMenuItem(opt, activeKey, onSelect);
  });
};

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
      <div className={styles.popup}>{renderItems(options, activeKey, loading, onSelect)}</div>
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
      <div className={styles.popup}>{renderItems(options, activeKey, loading, onSelect)}</div>
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
