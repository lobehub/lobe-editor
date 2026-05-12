import { memo, useEffect, useRef, useState } from 'react';

import { generateSvgFromDiagram } from '../utils/meta2dManager';

/** Canvas2svg emits a large fixed width/height; without this the card clips to the top-left (overflow hidden). */
function injectPreviewSvgLayout(svg: string): string {
  const t = svg.trimStart();
  if (!t.startsWith('<svg')) return svg;
  return t.replace(
    /^<svg\b/,
    '<svg style="max-width:100%;height:auto;display:block;margin:0 auto" ',
  );
}

export interface DiagramPreviewProps {
  diagram: string;
  onDelete: () => void;
  onEdit: () => void;
  onSvgReady: (svg: string) => void;
  svg: string;
}

function HudButton({
  color,
  label,
  onClick,
  title,
}: {
  color: string;
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      style={{
        alignItems: 'center',
        background: '#fff',
        border: '1px solid #e5e5e5',
        borderRadius: 6,
        color,
        cursor: 'pointer',
        display: 'inline-flex',
        height: 28,
        justifyContent: 'center',
        width: 28,
      }}
      title={title}
      type="button"
    >
      {label}
    </button>
  );
}

function DiagramPreviewInner({ diagram, onDelete, onEdit, onSvgReady, svg }: DiagramPreviewProps) {
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [generationFailed, setGenerationFailed] = useState(false);
  /** 避免 diagram 已更新但节点仍保留旧 svg 时缩略图不刷新；与上次成功生成预览的 diagram 一致时可跳过 */
  const previewSyncedForDiagramRef = useRef<string | null>(null);

  useEffect(() => {
    setGenerationError(null);
    setGenerationFailed(false);
  }, [diagram]);

  useEffect(() => {
    if (!diagram || generationFailed || generating) return;
    if (svg) {
      previewSyncedForDiagramRef.current = diagram;
      return;
    }
    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      setGenerationError('Preview timeout (still loading). Double-click to open editor.');
      setGenerationFailed(true);
      setGenerating(false);
    }, 5000);

    setGenerating(true);
    generateSvgFromDiagram(diagram)
      .then((nextSvg) => {
        if (!active) return;
        window.clearTimeout(timeoutId);
        if (nextSvg) {
          previewSyncedForDiagramRef.current = diagram;
          onSvgReady(nextSvg);
          return;
        }
        setGenerationError('Preview generation failed. Double-click to open editor.');
        setGenerationFailed(true);
      })
      .finally(() => {
        if (active) setGenerating(false);
      });
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [diagram, generationFailed, onSvgReady, svg]);

  return (
    <div
      onDoubleClick={(event) => {
        event.stopPropagation();
        onEdit();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: '1px solid #efefef',
        borderRadius: 10,
        cursor: 'pointer',
        minHeight: 140,
        overflow: 'hidden',
        padding: 10,
        position: 'relative',
      }}
    >
      {hovered && !!svg && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            position: 'absolute',
            right: 10,
            top: 10,
            zIndex: 1,
          }}
        >
          <HudButton color="#1677ff" label="✎" onClick={onEdit} title="Edit diagram" />
          <HudButton color="#ff4d4f" label="🗑" onClick={onDelete} title="Delete diagram" />
        </div>
      )}
      {svg ? (
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'center',
            maxHeight: 400,
            overflow: 'auto',
            width: '100%',
          }}
        >
          <div
            dangerouslySetInnerHTML={{ __html: injectPreviewSvgLayout(svg) }}
            style={{ lineHeight: 0, maxWidth: '100%', width: '100%' }}
          />
        </div>
      ) : (
        <div
          style={{
            alignItems: 'center',
            color: generationError ? '#cf1322' : '#999',
            display: 'flex',
            justifyContent: 'center',
            minHeight: 120,
            textAlign: 'center',
          }}
        >
          {generating ? 'Generating preview...' : generationError || 'Double-click to edit diagram'}
        </div>
      )}
    </div>
  );
}

export const DiagramPreview = memo(DiagramPreviewInner);
