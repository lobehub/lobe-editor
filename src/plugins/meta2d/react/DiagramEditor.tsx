import { Meta2d } from '@meta2d/core';
import { type CSSProperties, useEffect, useRef, useState } from 'react';

import {
  EMPTY_META2D_PLACEHOLDER_SVG,
  createEmptyMeta2dData,
  ensureMeta2dShapes,
  generateSvgFromDiagram,
  sanitizeMeta2dData,
} from '../utils/meta2dManager';
import { DiagramPalette } from './DiagramPalette';

const buttonStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #d9d9d9',
  borderRadius: 6,
  cursor: 'pointer',
  minWidth: 68,
  padding: '6px 12px',
};

export interface DiagramEditorProps {
  diagram: string;
  onClose: () => void;
  onSave: (diagram: string, svg: string) => void;
}

export function DiagramEditor({ diagram, onClose, onSave }: DiagramEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Meta2d | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    ensureMeta2dShapes();
    const engine = new Meta2d(canvasRef.current, { grid: true, rule: false });
    engineRef.current = engine;

    try {
      if (diagram?.trim()) {
        engine.open(JSON.parse(diagram));
      } else {
        engine.open(createEmptyMeta2dData() as never);
      }
      engine.render(true);
    } catch {
      engine.open(createEmptyMeta2dData() as never);
      engine.render(true);
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleEsc);
      try {
        engine.destroy();
      } catch {
        // ignore
      }
      engineRef.current = null;
    };
  }, [diagram, onClose]);

  const handleSave = async () => {
    const engine = engineRef.current;
    if (!engine) return;

    setSaving(true);
    try {
      const sanitized = sanitizeMeta2dData(engine.data());
      const json = JSON.stringify(sanitized);
      const svg = (await generateSvgFromDiagram(json)) || EMPTY_META2D_PLACEHOLDER_SVG;
      onSave(json, svg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        alignItems: 'center',
        background: 'rgb(0 0 0 / 35%)',
        display: 'flex',
        inset: 0,
        justifyContent: 'center',
        position: 'fixed',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 10,
          boxShadow: '0 12px 30px rgb(0 0 0 / 20%)',
          display: 'flex',
          flexDirection: 'column',
          height: '86vh',
          maxWidth: '1200px',
          overflow: 'hidden',
          width: '92vw',
        }}
      >
        <div
          style={{
            alignItems: 'center',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            padding: '12px 16px',
          }}
        >
          <span style={{ fontWeight: 600 }}>Flow Diagram</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={buttonStyle} type="button">
              Close
            </button>
            <button
              disabled={saving}
              onClick={() => void handleSave()}
              style={{ ...buttonStyle, background: '#1677ff', border: 'none', color: '#fff' }}
              type="button"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <DiagramPalette />
          <div ref={canvasRef} style={{ flex: 1, minHeight: 0 }} />
        </div>
      </div>
    </div>
  );
}
