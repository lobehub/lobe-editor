'use client';

import { cx } from 'antd-style';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import type { FC, ReactNode } from 'react';

import { styles } from './style';
import type { TocItem } from './type';

interface TableOfContentsProps {
  activeKey: null | string;
  collapsed: boolean;
  emptyText: ReactNode;
  expandLabel: string;
  items: TocItem[];
  jumpTo: (_key: string) => void;
  pinLabel: string;
  pinned: boolean;
  setExpandedByHover: (expanded: boolean) => void;
  setPinned: (pinned: boolean) => void;
  showHeader?: boolean;
  title: ReactNode;
  unpinLabel: string;
}

const TocList: FC<{
  activeKey: null | string;
  items: TocItem[];
  jumpTo: (_key: string) => void;
}> = ({ activeKey, items, jumpTo }) => {
  return (
    <ol className={styles.list}>
      {items.map((item, index) => {
        const active = activeKey === item.key;
        const prefix = `${index + 1}.`;

        return (
          <li className={styles.item} key={item.key}>
            <button
              className={cx(styles.button, active && styles.buttonActive)}
              onClick={() => jumpTo(item.key)}
              style={{ paddingInlineStart: 8 + Math.max(item.depth - 1, 0) * 16 }}
              title={item.title}
              type="button"
            >
              <span className={cx(styles.marker, active && styles.markerActive)} />
              <span className={styles.text}>
                {prefix} {item.title}
              </span>
            </button>
            {item.children.length > 0 ? (
              <TocList activeKey={activeKey} items={item.children} jumpTo={jumpTo} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
};

function flattenItems(items: TocItem[]): TocItem[] {
  const result: TocItem[] = [];

  for (const item of items) {
    result.push(item, ...flattenItems(item.children));
  }

  return result;
}

const TableOfContents: FC<TableOfContentsProps> = ({
  activeKey,
  collapsed,
  emptyText,
  expandLabel,
  items,
  jumpTo,
  pinLabel,
  pinned,
  setExpandedByHover,
  setPinned,
  showHeader = true,
  title,
  unpinLabel,
}) => {
  if (collapsed) {
    const railItems = flattenItems(items).slice(0, 10);

    return (
      <button
        aria-label={expandLabel}
        className={styles.rail}
        onClick={() => setExpandedByHover(true)}
        onMouseEnter={() => setExpandedByHover(true)}
        onPointerEnter={() => setExpandedByHover(true)}
        type="button"
      >
        {(railItems.length > 0 ? railItems : [{ key: 'empty' } as TocItem]).map((item) => (
          <span
            aria-hidden
            className={cx(styles.railBar, item.key === activeKey && styles.railBarActive)}
            key={item.key}
            style={{ width: Math.max(14, 30 - Math.max(item.depth - 1, 0) * 6) }}
          />
        ))}
      </button>
    );
  }

  return (
    <>
      {showHeader ? (
        <div className={styles.header}>
          <span>{title}</span>
          <span className={styles.headerActions}>
            <button
              aria-label={pinned ? unpinLabel : pinLabel}
              className={styles.iconButton}
              onClick={() => setPinned(!pinned)}
              title={pinned ? unpinLabel : pinLabel}
              type="button"
            >
              {pinned ? (
                <EyeIcon aria-hidden className={styles.icon} />
              ) : (
                <EyeOffIcon aria-hidden className={styles.icon} />
              )}
            </button>
          </span>
        </div>
      ) : null}
      {items.length > 0 ? (
        <TocList activeKey={activeKey} items={items} jumpTo={jumpTo} />
      ) : (
        <div className={styles.empty}>{emptyText}</div>
      )}
    </>
  );
};

export default TableOfContents;
