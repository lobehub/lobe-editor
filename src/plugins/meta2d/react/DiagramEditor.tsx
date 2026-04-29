import { Meta2d } from '@meta2d/core';
import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { useEditorLocale } from '@/react/hooks/useEditorLocale';

import {
  EMPTY_META2D_PLACEHOLDER_SVG,
  createEmptyMeta2dData,
  ensureMeta2dShapes,
  generateSvgFromDiagram,
  sanitizeMeta2dData,
} from '../utils/meta2dManager';
import { DiagramPalette } from './DiagramPalette';
import { PenProps } from './PenProps';

const buttonStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #d9d9d9',
  borderRadius: 6,
  cursor: 'pointer',
  minWidth: 68,
  padding: '6px 12px',
};

const toolBtnStyle: CSSProperties = {
  ...buttonStyle,
  fontSize: 12,
  minWidth: 52,
  padding: '4px 10px',
};

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [active]);
}

export interface DiagramEditorProps {
  diagram: string;
  onClose: () => void;
  onSave: (diagram: string, svg: string) => void;
}

export function DiagramEditor({ diagram, onClose, onSave }: DiagramEditorProps) {
  const { t } = useEditorLocale();
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Meta2d | null>(null);
  const [engine, setEngine] = useState<Meta2d | null>(null);
  const [saving, setSaving] = useState(false);

  useBodyScrollLock(true);

  useEffect(() => {
    if (!canvasRef.current) return;

    ensureMeta2dShapes();
    const engine = new Meta2d(canvasRef.current, { grid: true, rule: false });
    engineRef.current = engine;
    setEngine(engine);

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

  const runEngine = (fn: (m: Meta2d) => void) => {
    const m = engineRef.current;
    if (m) fn(m);
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
        overflow: 'hidden',
        position: 'fixed',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 10,
          boxShadow: '0 12px 30px rgb(0 0 0 / 20%)',
          display: 'flex',
          flexDirection: 'column',
          height: '86vh',
          maxHeight: '100%',
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
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'space-between',
            padding: '10px 14px',
          }}
        >
          <span style={{ fontWeight: 600 }}>{t('meta2d.editor.title')}</span>
          <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                onClick={() => runEngine((m) => m.undo())}
                style={toolBtnStyle}
                title={`${t('meta2d.editor.undo')} (Ctrl+Z)`}
                type="button"
              >
                {t('meta2d.editor.undo')}
              </button>
              <button
                onClick={() => runEngine((m) => m.redo())}
                style={toolBtnStyle}
                title={`${t('meta2d.editor.redo')} (Ctrl+Y)`}
                type="button"
              >
                {t('meta2d.editor.redo')}
              </button>
              <button
                onClick={() => runEngine((m) => m.delete())}
                style={toolBtnStyle}
                title={t('meta2d.editor.delete')}
                type="button"
              >
                {t('meta2d.editor.delete')}
              </button>
              <button
                onClick={() => runEngine((m) => m.fitView(true))}
                style={toolBtnStyle}
                title={t('meta2d.editor.fit')}
                type="button"
              >
                {t('meta2d.editor.fit')}
              </button>
              <button
                onClick={() =>
                  runEngine((m) => {
                    m.scale(1);
                    m.centerView();
                  })
                }
                style={toolBtnStyle}
                title={t('meta2d.editor.zoom100')}
                type="button"
              >
                {t('meta2d.editor.zoom100')}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={buttonStyle} type="button">
                {t('meta2d.editor.close')}
              </button>
              <button
                disabled={saving}
                onClick={() => void handleSave()}
                style={{ ...buttonStyle, background: '#1677ff', border: 'none', color: '#fff' }}
                type="button"
              >
                {saving ? t('meta2d.editor.saving') : t('meta2d.editor.save')}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <DiagramPalette engineRef={engineRef} />
          <div ref={canvasRef} style={{ flex: 1, minHeight: 0, minWidth: 0 }} />
          <PenProps engine={engine} />
        </div>
      </div>
    </div>
  );
}
