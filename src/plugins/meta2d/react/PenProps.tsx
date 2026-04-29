import type { Meta2d } from '@meta2d/core';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';

type PenData = Record<string, unknown>;

const panelStyle: CSSProperties = {
  borderLeft: '1px solid #f0f0f0',
  flexShrink: 0,
  maxHeight: '100%',
  overflowX: 'hidden',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  touchAction: 'pan-y',
  width: 220,
};

const labelStyle: CSSProperties = {
  color: '#8c8c8c',
  fontSize: 12,
  marginBottom: 4,
};

const sectionStyle: CSSProperties = {
  borderBottom: '1px solid #f0f0f0',
  padding: '10px 12px',
};

const rowStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: 6,
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  background: '#fafafa',
  border: '1px solid #e5e5e5',
  borderRadius: 4,
  fontSize: 12,
  height: 28,
  outline: 'none',
  padding: '0 6px',
};

const fieldLabel: CSSProperties = {
  color: '#8c8c8c',
  fontSize: 11,
  minWidth: 22,
};

const layerBtn: CSSProperties = {
  background: '#fff',
  border: '1px solid #d9d9d9',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 11,
  minWidth: 48,
  padding: '4px 8px',
};

export function PenProps({ engine }: { engine: Meta2d | null }) {
  const [pen, setPen] = useState<PenData | null>(null);
  const [rect, setRect] = useState<{ height: number, width: number; x: number; y: number; } | null>(
    null,
  );
  const localRef = useRef<PenData>({});

  const selectHandler = useCallback(
    (pens?: PenData[]) => {
      if (!pens || pens.length !== 1) {
        setPen(null);
        setRect(null);
        return;
      }
      const p = pens[0];
      if (p.globalAlpha === null || p.globalAlpha === undefined) p.globalAlpha = 1;
      setPen(p);
      if (engine) {
        try {
          setRect(engine.getPenRect(p as never));
        } catch {
          setRect(null);
        }
      }
    },
    [engine],
  );

  const inactiveHandler = useCallback(() => {
    setPen(null);
    setRect(null);
  }, []);

  useEffect(() => {
    if (!engine) return;
    engine.on('active', selectHandler);
    engine.on('inactive', inactiveHandler);
    return () => {
      engine.off('active', selectHandler);
      engine.off('inactive', inactiveHandler);
    };
  }, [engine, selectHandler, inactiveHandler]);

  if (!pen || !engine) {
    return (
      <aside style={panelStyle}>
        <div style={{ color: '#bbb', fontSize: 12, padding: 16, textAlign: 'center' }}>
          Select a shape to edit its properties
        </div>
      </aside>
    );
  }

  const changeValue = (prop: string, value: unknown) => {
    localRef.current[prop] = value;
    const v: Record<string, unknown> = { id: pen.id };
    v[prop] = value;
    if (prop === 'dash') {
      const lineDashs = [undefined, [5, 5]];
      v.lineDash = lineDashs[value as number];
    }
    engine.setValue(v as never, { render: true } as never);
  };

  const changeRect = (prop: string, value: number) => {
    if (!rect) return;
    const updated: Record<string, unknown> = { id: pen.id };
    updated[prop] = value;
    engine.setValue(updated as never, { render: true } as never);
    setRect((r) => (r ? { ...r, [prop]: value } : null));
  };

  const changeLayer = (fn: (m: Meta2d) => void) => {
    fn(engine);
    engine.render(true);
  };

  return (
    <aside style={panelStyle}>
      {/* Text */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Text</div>
        <div style={rowStyle}>
          <input
            onChange={(e) => changeValue('text', e.target.value)}
            style={inputStyle}
            type="text"
            value={(pen.text as string) ?? ''}
          />
        </div>
      </div>

      {/* Appearance */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, marginBottom: 6 }}>Appearance</div>

        <div style={rowStyle}>
          <span style={fieldLabel}>Color</span>
          <input
            onChange={(e) => changeValue('color', e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
            type="color"
            value={(pen.color as string) || '#1f1f1f'}
          />
        </div>

        <div style={rowStyle}>
          <span style={fieldLabel}>Bg</span>
          <input
            onChange={(e) => changeValue('background', e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
            type="color"
            value={(pen.background as string) || '#ffffff'}
          />
        </div>

        <div style={rowStyle}>
          <span style={fieldLabel}>Dash</span>
          <select
            onChange={(e) => changeValue('dash', Number(e.target.value))}
            style={{ ...inputStyle, flex: 1 }}
            value={String((pen.dash as number) ?? 0)}
          >
            <option value="0">Solid</option>
            <option value="1">Dash</option>
          </select>
        </div>

        <div style={rowStyle}>
          <span style={fieldLabel}>Radius</span>
          <input
            max={1}
            min={0}
            onChange={(e) => changeValue('borderRadius', Number(e.target.value))}
            step={0.01}
            style={{ ...inputStyle, flex: 1 }}
            type="range"
            value={String((pen.borderRadius as number) ?? 0)}
          />
          <span style={{ color: '#8c8c8c', fontSize: 11, width: 32 }}>
            {(pen.borderRadius as number) ?? 0}
          </span>
        </div>

        <div style={rowStyle}>
          <span style={fieldLabel}>Alpha</span>
          <input
            max={1}
            min={0}
            onChange={(e) => changeValue('globalAlpha', Number(e.target.value))}
            step={0.01}
            style={{ ...inputStyle, flex: 1 }}
            type="range"
            value={String((pen.globalAlpha as number) ?? 1)}
          />
          <span style={{ color: '#8c8c8c', fontSize: 11, width: 32 }}>
            {((pen.globalAlpha as number) ?? 1).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Position & Size */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, marginBottom: 6 }}>Position &amp; Size</div>
        {(
          [
            ['X', 'x'],
            ['Y', 'y'],
            ['W', 'width'],
            ['H', 'height'],
          ] as const
        ).map(([label, key]) => (
          <div key={key} style={rowStyle}>
            <span style={fieldLabel}>{label}</span>
            <input
              onChange={(e) => changeRect(key, Number(e.target.value))}
              style={{ ...inputStyle, flex: 1 }}
              type="number"
              value={rect ? rect[key] : 0}
            />
          </div>
        ))}
      </div>

      {/* Text alignment */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, marginBottom: 6 }}>Text align</div>
        <div style={rowStyle}>
          <span style={fieldLabel}>H</span>
          <select
            onChange={(e) => changeValue('textAlign', e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
            value={(pen.textAlign as string) || 'center'}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
        <div style={rowStyle}>
          <span style={fieldLabel}>V</span>
          <select
            onChange={(e) => changeValue('textBaseline', e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
            value={(pen.textBaseline as string) || 'middle'}
          >
            <option value="top">Top</option>
            <option value="middle">Middle</option>
            <option value="bottom">Bottom</option>
          </select>
        </div>
      </div>

      {/* Layer */}
      <div style={sectionStyle}>
        <div style={{ ...labelStyle, marginBottom: 6 }}>Layer</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <button onClick={() => changeLayer((m) => m.top())} style={layerBtn} type="button">
            Top
          </button>
          <button onClick={() => changeLayer((m) => m.up())} style={layerBtn} type="button">
            Up
          </button>
          <button onClick={() => changeLayer((m) => m.down())} style={layerBtn} type="button">
            Down
          </button>
          <button onClick={() => changeLayer((m) => m.bottom())} style={layerBtn} type="button">
            Bottom
          </button>
        </div>
      </div>
    </aside>
  );
}
