'use client';

import { Highlighter } from '@lobehub/ui';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

import MermaidWithErrorBoundary from '@/plugins/common/react/MermaidWithErrorBoundary';

function isLikelyInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest?.('button, a[href], [role="button"], input, textarea, select'));
}

export interface MermaidPreviewBlockProps {
  /** Stable key within list (serialized node key); used for nested Mermaid only. */
  blockKey?: string;
  code: string;
}

/**
 * Preview-only Mermaid block: renders the diagram by default; clicking the chart area
 * shows the source above; clicking outside the block hides the source again.
 */
export const MermaidPreviewBlock = memo(function MermaidPreviewBlock({
  blockKey,
  code,
}: MermaidPreviewBlockProps) {
  const trimmed = (code ?? '').trim();
  const [sourceVisible, setSourceVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const openSource = useCallback((e?: ReactMouseEvent) => {
    if (e && isLikelyInteractiveTarget(e.target)) return;
    setSourceVisible(true);
  }, []);

  useEffect(() => {
    if (!sourceVisible) return;
    const onDocPointerDown = (event: MouseEvent | PointerEvent) => {
      const root = rootRef.current;
      if (!root?.contains(event.target as Node)) {
        setSourceVisible(false);
      }
    };
    document.addEventListener('mousedown', onDocPointerDown, true);
    return () => document.removeEventListener('mousedown', onDocPointerDown, true);
  }, [sourceVisible]);

  return (
    <div data-code-type="mermaid" ref={rootRef} style={{ width: '100%' }}>
      {sourceVisible && (
        <div style={{ marginBlockEnd: 8, width: '100%' }}>
          <Highlighter defaultExpand language="mermaid" variant="filled">
            {trimmed}
          </Highlighter>
        </div>
      )}
      <div
        aria-expanded={sourceVisible}
        aria-label={
          sourceVisible
            ? 'Mermaid 图表（已展开源码）'
            : 'Mermaid 图表，点击或按 Enter 在上方查看源码'
        }
        onClick={(e) => openSource(e)}
        onKeyDown={(e) => {
          if (!sourceVisible && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setSourceVisible(true);
          }
        }}
        role="group"
        style={{
          cursor: sourceVisible ? 'default' : 'pointer',
          outline: 'none',
          width: '100%',
        }}
        tabIndex={0}
      >
        {/* 与 CodemirrorBlock 预览区一致：限高 + 内部滚动，避免父级 overflow 裁切整张图 */}
        <div
          style={{
            maxHeight: 'min(480px, 55vh)',
            overflowX: 'auto',
            overflowY: 'auto',
            width: '100%',
          }}
        >
          <MermaidWithErrorBoundary
            animated={false}
            copyable={true}
            fullFeatured={false}
            key={blockKey ?? trimmed.slice(0, 32)}
            showLanguage={true}
            style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
            theme="lobe-theme"
            variant="filled"
          >
            {trimmed}
          </MermaidWithErrorBoundary>
        </div>
      </div>
    </div>
  );
});

MermaidPreviewBlock.displayName = 'MermaidPreviewBlock';
