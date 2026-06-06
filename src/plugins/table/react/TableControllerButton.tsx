import { cx } from 'antd-style';
import { type CSSProperties, type ReactNode, memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface TableControllerButtonProps {
  ariaLabel: string;
  children: ReactNode;
  className: string;
  gap?: number;
  offset?: number;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  position: 'left' | 'top';
  reference: HTMLElement | null;
  visible: boolean;
  visibleClassName: string;
}

const BUTTON_SIZE = 24;

const getPortalContainer = () => {
  if (typeof document === 'undefined') {
    return null;
  }

  return (document.querySelector('.ant-app') as HTMLElement | null) || document.body;
};

const getButtonStyle = (
  reference: HTMLElement | null,
  position: TableControllerButtonProps['position'],
  offset = 0,
  gap: number,
): CSSProperties => {
  if (!reference) {
    return {};
  }

  const rect = reference.getBoundingClientRect();
  const minCenter = BUTTON_SIZE / 2 + gap;
  const maxInlineCenter = window.innerWidth - BUTTON_SIZE / 2 - gap;
  const maxBlockCenter = window.innerHeight - BUTTON_SIZE / 2 - gap;
  const clampCenter = (value: number, max: number) => {
    return Math.min(Math.max(value, minCenter), max);
  };

  if (position === 'top') {
    const preferredTop = rect.top - BUTTON_SIZE / 2 - gap;
    const fallbackTop = rect.bottom + BUTTON_SIZE / 2 + gap;

    return {
      insetBlockStart:
        preferredTop >= minCenter ? preferredTop : clampCenter(fallbackTop, maxBlockCenter),
      insetInlineStart: clampCenter(rect.left + offset, maxInlineCenter),
    };
  }

  const preferredLeft = rect.left - BUTTON_SIZE / 2 - gap;
  const fallbackLeft = rect.right + BUTTON_SIZE / 2 + gap;

  return {
    insetBlockStart: clampCenter(rect.top + offset, maxBlockCenter),
    insetInlineStart:
      preferredLeft >= minCenter ? preferredLeft : clampCenter(fallbackLeft, maxInlineCenter),
  };
};

const TableControllerButton = memo<TableControllerButtonProps>(
  ({
    ariaLabel,
    children,
    className,
    gap = 6,
    offset,
    onClick,
    onMouseEnter,
    onMouseLeave,
    position,
    reference,
    visible,
    visibleClassName,
  }) => {
    const [style, setStyle] = useState<CSSProperties>(() =>
      getButtonStyle(reference, position, offset, gap),
    );
    const container = getPortalContainer();

    useEffect(() => {
      if (!visible || !reference) {
        return;
      }

      const updateStyle = () => {
        setStyle(getButtonStyle(reference, position, offset, gap));
      };

      updateStyle();
      window.addEventListener('scroll', updateStyle, true);
      window.addEventListener('resize', updateStyle);

      const observer = new ResizeObserver(updateStyle);
      observer.observe(reference);

      return () => {
        window.removeEventListener('scroll', updateStyle, true);
        window.removeEventListener('resize', updateStyle);
        observer.disconnect();
      };
    }, [gap, offset, position, reference, visible]);

    if (!container) {
      return null;
    }

    return createPortal(
      <button
        aria-hidden={!visible}
        aria-label={ariaLabel}
        className={cx(className, visible && visibleClassName)}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (!visible) {
            return;
          }

          onClick();
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={style}
        tabIndex={visible ? 0 : -1}
        type="button"
      >
        {children}
      </button>,
      container,
    );
  },
);

TableControllerButton.displayName = 'TableControllerButton';

export default TableControllerButton;
