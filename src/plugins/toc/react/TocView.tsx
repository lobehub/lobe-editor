'use client';

import { cx } from 'antd-style';
import {
  type CSSProperties,
  type FC,
  useCallback,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import type { IEditor } from '@/types';

import { TocPlugin } from '../plugin';
import TableOfContents from './TableOfContents';
import { resolveTocScrollContainer } from './getNearestScrollContainer';
import { useActiveHeading } from './hooks/useActiveHeading';
import { usePinnedTocReserve } from './hooks/usePinnedTocReserve';
import { useTocAnchor } from './hooks/useTocAnchor';
import { useTocItems } from './hooks/useTocItems';
import { styles } from './style';
import type { ReactTocPluginProps } from './type';

type TocViewProps = ReactTocPluginProps & { editor: IEditor };

function getFixedStyle(
  pinned: boolean,
  tocAnchor: ReturnType<typeof useTocAnchor>,
): CSSProperties | undefined {
  const stuck = Boolean(pinned && tocAnchor?.stuck);

  return stuck && tocAnchor
    ? {
        insetBlockStart: tocAnchor.top,
        insetInlineStart: tocAnchor.left,
        width: tocAnchor.width,
      }
    : undefined;
}

function getSlotStyle(
  style: CSSProperties | undefined,
  tocAnchor: ReturnType<typeof useTocAnchor>,
): CSSProperties | undefined {
  return tocAnchor
    ? {
        ...style,
        insetBlockStart: tocAnchor.slotTop,
      }
    : style;
}

function getBottomedStyle(
  pinned: boolean,
  tocAnchor: ReturnType<typeof useTocAnchor>,
): CSSProperties | undefined {
  return pinned && tocAnchor?.bottomed
    ? {
        insetBlockStart: tocAnchor.bottomTop,
        width: tocAnchor.width,
      }
    : undefined;
}

const TocView: FC<TocViewProps> = ({
  behavior = 'smooth',
  className,
  defaultPinned = false,
  emptyText,
  editor,
  getScrollContainer,
  locale,
  maxDepth = 6,
  minDepth = 1,
  offsetTop = 8,
  onItemsChange,
  onPinnedChange,
  render,
  reserveGap = 24,
  reserveOnPinned = true,
  showHeader,
  style,
  title,
}) => {
  const slotRef = useRef<HTMLDivElement>(null);
  const [expandedByHover, setExpandedByHover] = useState(false);
  const [, setLocaleVersion] = useState(0);
  const [pinned, setPinnedState] = useState(defaultPinned);
  const collapsed = !pinned && !expandedByHover;
  const { activeKey, items, service } = useTocItems({
    editor,
    maxDepth,
    minDepth,
    onItemsChange,
  });
  const tocAnchor = useTocAnchor({ editor, offsetTop, pinned, slotRef });

  const setPinned = useCallback(
    (nextPinned: boolean) => {
      setPinnedState(nextPinned);
      setExpandedByHover(nextPinned);
      onPinnedChange?.(nextPinned);
    },
    [onPinnedChange],
  );

  useInsertionEffect(() => {
    editor.registerPlugin(TocPlugin, { maxDepth, minDepth });
  }, [editor, maxDepth, minDepth]);

  useLayoutEffect(() => {
    if (locale) {
      editor.registerLocale(locale);
      setLocaleVersion((version) => version + 1);
    }
  }, [editor, locale]);

  usePinnedTocReserve({ editor, pinned, reserveGap, reserveOnPinned, tocAnchor });
  useActiveHeading({ editor, getScrollContainer, offsetTop, service });

  const jumpTo = useCallback(
    (key: string) => {
      const scrollContainer = resolveTocScrollContainer(editor, getScrollContainer);
      service?.jumpTo(key, { behavior, container: scrollContainer, offsetTop });
    },
    [behavior, editor, getScrollContainer, offsetTop, service],
  );

  const content = render ? (
    render({ activeKey, collapsed, items, jumpTo, pinned, setPinned })
  ) : (
    <TableOfContents
      activeKey={activeKey}
      collapsed={collapsed}
      emptyText={emptyText ?? editor.t('toc.empty')}
      expandLabel={editor.t('toc.expand')}
      items={items}
      jumpTo={jumpTo}
      pinLabel={editor.t('toc.pin')}
      pinned={pinned}
      setExpandedByHover={setExpandedByHover}
      setPinned={setPinned}
      showHeader={showHeader}
      title={title ?? editor.t('toc.title')}
      unpinLabel={editor.t('toc.unpin')}
    />
  );
  const fixedStyle = getFixedStyle(pinned, tocAnchor);
  const bottomedStyle = getBottomedStyle(pinned, tocAnchor);
  const slotStyle = getSlotStyle(style, tocAnchor);
  const stuck = Boolean(pinned && tocAnchor?.stuck);
  const bottomed = Boolean(pinned && tocAnchor?.bottomed);

  return (
    <div
      className={cx(styles.slot, pinned ? styles.slotPinned : styles.slotFloating, className)}
      onMouseEnter={() => setExpandedByHover(true)}
      onMouseLeave={() => {
        if (!pinned) {
          setExpandedByHover(false);
        }
      }}
      onPointerEnter={() => setExpandedByHover(true)}
      onPointerLeave={() => {
        if (!pinned) {
          setExpandedByHover(false);
        }
      }}
      ref={slotRef}
      style={slotStyle}
    >
      <nav
        aria-label={editor.t('toc.ariaLabel')}
        className={cx(
          styles.root,
          pinned
            ? stuck
              ? styles.rootPinnedFixed
              : bottomed
                ? styles.rootPinnedBottomed
                : styles.rootPinned
            : styles.rootFloating,
          collapsed && styles.rootCollapsed,
        )}
        style={fixedStyle ?? bottomedStyle}
      >
        {content}
      </nav>
    </div>
  );
};

TocView.displayName = 'TocView';

export default TocView;
