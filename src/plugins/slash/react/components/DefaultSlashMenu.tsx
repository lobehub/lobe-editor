'use client';

import { type Placement, flip, offset, shift, useFloating } from '@floating-ui/react';
import { Icon, menuSharedStyles } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { type FC, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import { ISlashMenuOption } from '../../service/i-slash-service';
import type { SlashMenuProps } from '../type';

const LOBE_THEME_APP_ID = 'lobe-ui-theme-app';

const styles = createStaticStyles(({ css, cssVar }) => ({
  popup: css`
    scrollbar-width: none;

    overflow-y: auto;

    min-width: 200px;
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
  root: css`
    z-index: 1100;
    width: max-content;
  `,
}));

const isDividerOption = (option: SlashMenuProps['options'][number]): boolean =>
  'type' in option && option.type === 'divider';

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

  const hasVisibleItems = options?.some((item) => !isDividerOption(item));
  if (!open || !hasVisibleItems) return null;

  const portalContainer =
    getPopupContainer?.() || document.getElementById(LOBE_THEME_APP_ID) || document.body;

  const renderedItems = loading ? (
    <div className={menuSharedStyles.empty}>Loading...</div>
  ) : (
    options.map((opt, index) => {
      if (isDividerOption(opt)) {
        return <div className={menuSharedStyles.separator} key={`__divider_${index}`} />;
      }

      const item = opt as ISlashMenuOption;
      const isHighlighted = item.key === activeKey;
      const isDisabled = Boolean(item.disabled);

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
          <span className={menuSharedStyles.label}>{item.label}</span>
          {item.extra ? <span className={menuSharedStyles.extra}>{item.extra}</span> : null}
        </div>
      );
    })
  );

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
      <div className={styles.popup}>{renderedItems}</div>
    </div>
  );

  return createPortal(node, portalContainer);
};

DefaultSlashMenu.displayName = 'DefaultSlashMenu';

export default DefaultSlashMenu;
