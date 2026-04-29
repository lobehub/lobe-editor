import { useMemo } from 'react';

import { type PaletteItem, getPalette } from './diagram-pens';

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
  if (name === 'line') {
    return (
      <svg height="24" viewBox="0 0 28 28" width="24">
        <line x1="4" x2="24" y1="14" y2="14" {...common} />
      </svg>
    );
  }
  return (
    <svg height="24" viewBox="0 0 28 28" width="24">
      <rect height="14" rx="2" width="20" x="4" y="7" {...common} />
    </svg>
  );
}

function PaletteTile({ disabled, item }: { disabled?: boolean; item: PaletteItem }) {
  return (
    <div
      draggable={!disabled}
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
        padding: 6,
      }}
      title={item.label}
    >
      <ShapePreview name={String(item.pen.name ?? 'rectangle')} />
      <span style={{ fontSize: 11 }}>{item.label}</span>
    </div>
  );
}

export function DiagramPalette({ disabled }: { disabled?: boolean }) {
  const groups = useMemo(() => groupPalette(getPalette()), []);

  return (
    <aside
      style={{
        borderRight: '1px solid #f0f0f0',
        overflow: 'auto',
        padding: 12,
        width: 220,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Components</div>
      <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 12 }}>Drag into canvas</div>
      {groups.map(([group, items]) => (
        <div key={group} style={{ marginBottom: 12 }}>
          <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 6 }}>{group}</div>
          <div
            style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
          >
            {items.map((item) => (
              <PaletteTile disabled={disabled} item={item} key={item.key} />
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}
