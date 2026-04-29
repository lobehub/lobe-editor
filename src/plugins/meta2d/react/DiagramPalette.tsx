import type { Meta2d } from '@meta2d/core';
import type { RefObject } from 'react';
import { useMemo } from 'react';

import { useEditorLocale } from '@/react/hooks/useEditorLocale';

import { GROUP_LOCALE_MAP, type PaletteItem, getPalette, itemLabelLocaleKey } from './diagram-pens';

function clonePen(pen: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(pen);
}

function groupPalette(items: PaletteItem[]): [string, PaletteItem[]][] {
  const map = new Map<string, PaletteItem[]>();
  for (const item of items) {
    const list = map.get(item.group) ?? [];
    list.push(item);
    map.set(item.group, list);
  }
  return Array.from(map.entries());
}

function ShapePreview({ name }: { name: string }) {
  const common = { fill: '#fff', stroke: '#1f1f1f', strokeWidth: 1.2 } as const;
  if (name === 'circle') {
    return (
      <svg height="24" viewBox="0 0 28 28" width="24">
        <circle cx="14" cy="14" r="10" {...common} />
      </svg>
    );
  }
  if (name === 'diamond') {
    return (
      <svg height="24" viewBox="0 0 28 28" width="24">
        <polygon points="14,3 25,14 14,25 3,14" {...common} />
      </svg>
    );
  }
  if (name === 'triangle') {
    return (
      <svg height="24" viewBox="0 0 28 28" width="24">
        <polygon points="14,4 25,24 3,24" {...common} />
      </svg>
    );
  }
  if (name === 'pentagon') {
    return (
      <svg height="24" viewBox="0 0 28 28" width="24">
        <polygon points="14,3 25,12 21,25 7,25 3,12" {...common} />
      </svg>
    );
  }
  if (name === 'hexagon') {
    return (
      <svg height="24" viewBox="0 0 28 28" width="24">
        <polygon points="8,4 20,4 25,14 20,24 8,24 3,14" {...common} />
      </svg>
    );
  }
  if (name === 'pentagram') {
    return (
      <svg height="24" viewBox="0 0 28 28" width="24">
        <polygon points="14,3 17,11 26,11 18,16 21,25 14,20 7,25 10,16 2,11 11,11" {...common} />
      </svg>
    );
  }
  if (name === 'line') {
    return (
      <svg height="24" viewBox="0 0 28 28" width="24">
        <line x1="4" x2="24" y1="14" y2="14" {...common} />
      </svg>
    );
  }
  if (name === 'text') {
    return (
      <svg height="24" viewBox="0 0 28 28" width="24">
        <text
          dominantBaseline="middle"
          fill="#1f1f1f"
          fontSize="14"
          textAnchor="middle"
          x="14"
          y="15"
        >
          T
        </text>
      </svg>
    );
  }
  return (
    <svg height="24" viewBox="0 0 28 28" width="24">
      <rect height="14" rx="2" width="20" x="4" y="7" {...common} />
    </svg>
  );
}

function PaletteTile({
  disabled,
  engineRef,
  item,
  t,
}: {
  disabled?: boolean;
  engineRef: RefObject<Meta2d | null>;
  item: PaletteItem;
  t: (key: string, params?: Record<string, any>) => string;
}) {
  const addOnClick = () => {
    const engine = engineRef.current;
    if (!engine || disabled) return;
    try {
      engine.canvas.addCaches = [clonePen(item.pen)];
    } catch {
      // ignore
    }
  };

  return (
    <div
      draggable={!disabled}
      onClick={(event) => {
        event.stopPropagation();
        addOnClick();
      }}
      onDragStart={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        const payload = JSON.stringify(item.pen);
        event.dataTransfer.setData('Meta2d', payload);
        event.dataTransfer.setData('Text', payload);
        event.dataTransfer.effectAllowed = 'copy';
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          addOnClick();
        }
      }}
      role="button"
      style={{
        alignItems: 'center',
        border: '1px solid #efefef',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'grab',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        justifyContent: 'center',
        minHeight: 56,
        opacity: disabled ? 0.5 : 1,
        outline: 'none',
        padding: 6,
      }}
      tabIndex={disabled ? -1 : 0}
      title={`${t(itemLabelLocaleKey(item.key)) || item.label} — drag or click to add`}
    >
      <ShapePreview name={String(item.pen.name ?? 'rectangle')} />
      <span style={{ fontSize: 11 }}>{t(itemLabelLocaleKey(item.key)) || item.label}</span>
    </div>
  );
}

export function DiagramPalette({
  disabled,
  engineRef,
}: {
  disabled?: boolean;
  engineRef: RefObject<Meta2d | null>;
}) {
  const { t } = useEditorLocale();
  const groups = useMemo(() => groupPalette(getPalette()), []);

  return (
    <aside
      style={{
        borderRight: '1px solid #f0f0f0',
        flexShrink: 0,
        maxHeight: '100%',
        overflowX: 'hidden',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        padding: 12,
        touchAction: 'pan-y',
        width: 240,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
        {t('meta2d.palette.title')}
      </div>
      <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 12 }}>
        {t('meta2d.palette.hint')}
      </div>
      {groups.map(([group, items]) => (
        <div key={group} style={{ marginBottom: 12 }}>
          <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 6 }}>
            {t(GROUP_LOCALE_MAP[group] || group)}
          </div>
          <div
            style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
          >
            {items.map((item) => (
              <PaletteTile
                disabled={disabled}
                engineRef={engineRef}
                item={item}
                key={item.key}
                t={t}
              />
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}
