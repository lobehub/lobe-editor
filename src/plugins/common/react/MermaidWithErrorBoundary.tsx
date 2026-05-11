'use client';

import { Mermaid } from '@lobehub/ui';
import mermaid from 'mermaid';
import React, {
  Component,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// Mermaid 渲染错误边界
// ============================================================================
interface MermaidErrorBoundaryProps {
  children: ReactNode;
  code?: string;
  fallback?: (error: Error) => ReactNode;
}

interface MermaidErrorBoundaryState {
  error: Error | null;
  hasError: boolean;
}

class MermaidRenderErrorBoundary extends Component<
  MermaidErrorBoundaryProps,
  MermaidErrorBoundaryState
> {
  constructor(props: MermaidErrorBoundaryProps) {
    super(props);
    this.state = { error: null, hasError: false };
  }

  static getDerivedStateFromError(error: Error): MermaidErrorBoundaryState {
    return { error, hasError: true };
  }

  componentDidUpdate(prevProps: MermaidErrorBoundaryProps) {
    if (prevProps.code !== this.props.code) {
      this.setState({ error: null, hasError: false });
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback?.(this.state.error) ?? null;
    }
    return this.props.children;
  }
}

// ============================================================================
// Mermaid 渲染失败时的 Fallback UI
// ============================================================================
const ErrorFallback = memo<{ error: Error }>(({ error }) => {
  const errorMsg = error.message || 'Mermaid 渲染失败，请检查语法';
  return (
    <div
      style={{
        background: 'rgba(255, 77, 79, 0.08)',
        border: '1px solid rgba(255, 77, 79, 0.3)',
        borderRadius: 8,
        padding: 16,
        width: '100%',
      }}
    >
      <div style={{ color: '#ff4d4f', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
        ⚠️ Mermaid 渲染失败
      </div>
      <div
        style={{
          color: '#ff7875',
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {errorMsg}
      </div>
    </div>
  );
});

// ============================================================================
// 全屏 SVG 预览浮层（缩放 + 拖拽 + 工具栏）
// ============================================================================
const MIN_SCALE = 0.2;
const MAX_SCALE = 10;
const SCALE_STEP = 0.25;
const clampScale = (v: number) => Math.min(Math.max(MIN_SCALE, v), MAX_SCALE);

const SvgPreviewOverlay: React.FC<{ onClose: () => void; svg: string }> = ({ onClose, svg }) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const zoomIn = useCallback(() => setScale((s) => clampScale(s + SCALE_STEP)), []);
  const zoomOut = useCallback(() => setScale((s) => clampScale(s - SCALE_STEP)), []);
  const resetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Wheel zoom
  useEffect(() => {
    const el = backdropRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setScale((prev) => clampScale(prev * (e.deltaY > 0 ? 0.9 : 1.1)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Drag handlers — all on the content element via setPointerCapture
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    hasDraggedRef.current = false;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        hasDraggedRef.current = true;
      }
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleBackdropClick = useCallback(() => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    onClose();
  }, [onClose]);

  const pct = `${Math.round(scale * 100)}%`;

  const btnBase: React.CSSProperties = {
    alignItems: 'center',
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    display: 'inline-flex',
    fontSize: 14,
    height: 32,
    justifyContent: 'center',
    lineHeight: 1,
    minWidth: 32,
    padding: '0 8px',
  };

  return createPortal(
    <div
      onClick={handleBackdropClick}
      ref={backdropRef}
      style={{
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        inset: 0,
        justifyContent: 'center',
        position: 'fixed',
        zIndex: 1080,
      }}
    >
      {/* Close button (top-right) */}
      <button
        aria-label="Close preview"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          ...btnBase,
          background: 'rgba(255,255,255,0.12)',
          height: 40,
          minWidth: 40,
          position: 'absolute',
          right: 16,
          top: 16,
          zIndex: 2,
        }}
        type="button"
      >
        <svg
          fill="none"
          height="18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="18"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {/* SVG content (draggable + zoomable) */}
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          background: '#fff',
          borderRadius: 8,
          cursor: dragging ? 'grabbing' : 'grab',
          padding: 24,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          userSelect: 'none',
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: svg }} style={{ pointerEvents: 'none' }} />
      </div>

      {/* Bottom toolbar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.55)',
          borderRadius: 8,
          bottom: 24,
          display: 'flex',
          gap: 4,
          left: '50%',
          padding: '4px 8px',
          position: 'absolute',
          transform: 'translateX(-50%)',
          zIndex: 2,
        }}
      >
        <button
          aria-label="Zoom out"
          disabled={scale <= MIN_SCALE}
          onClick={zoomOut}
          style={{ ...btnBase, opacity: scale <= MIN_SCALE ? 0.4 : 1 }}
          type="button"
        >
          <svg
            fill="none"
            height="16"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="16"
          >
            <path d="M5 12h14" />
          </svg>
        </button>

        <button
          aria-label="Reset zoom"
          onClick={resetZoom}
          style={{ ...btnBase, fontFamily: 'monospace', minWidth: 56, userSelect: 'none' }}
          type="button"
        >
          {pct}
        </button>

        <button
          aria-label="Zoom in"
          disabled={scale >= MAX_SCALE}
          onClick={zoomIn}
          style={{ ...btnBase, opacity: scale >= MAX_SCALE ? 0.4 : 1 }}
          type="button"
        >
          <svg
            fill="none"
            height="16"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="16"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>,
    document.body,
  );
};

// ============================================================================
// 带完整错误处理的 Mermaid 包装组件
// ============================================================================
interface MermaidWithErrorBoundaryProps {
  animated?: boolean;
  children: string;
  copyable?: boolean;
  enableImagePreview?: boolean;
  fullFeatured?: boolean;
  key?: string;
  showLanguage?: boolean;
  style?: React.CSSProperties;
  theme?:
    | 'base'
    | 'default'
    | 'lobe-theme'
    | 'dark'
    | 'forest'
    | 'neutral'
    | 'neo'
    | 'neo-dark'
    | 'redux'
    | 'redux-dark'
    | 'redux-color'
    | 'redux-dark-color'
    | 'null';
  variant?: 'filled' | 'outlined' | 'borderless';
}

/**
 * 带完整错误处理的 Mermaid 包装组件
 *
 * 错误捕获层级：
 * 1. 预解析检测：mermaid.parse() 异步检测语法错误（能捕获 parse 阶段的错误）
 * 2. 渲染错误边界：Class ErrorBoundary 捕获 React 渲染期间的错误（能捕获 render 阶段的错误）
 * 3. 代码变化时自动重置错误状态
 */
const MermaidWithErrorBoundary = memo<MermaidWithErrorBoundaryProps>(
  ({ children, enableImagePreview = true, ...props }) => {
    const code = children.trim();
    const renderId = `mermaid-validate-${useId().replaceAll(':', '')}`;
    const [error, setError] = useState<Error | null>(null);
    const [svg, setSvg] = useState<string>('');
    const [previewOpen, setPreviewOpen] = useState(false);

    useEffect(() => {
      let canceled = false;
      setError(null);
      setSvg('');

      if (!code) return;

      Promise.resolve()
        .then(async () => {
          await mermaid.parse(code);
          return mermaid.render(renderId, code);
        })
        .then(
          ({ svg }) => {
            if (!canceled) setSvg(svg);
          },
          (error) => {
            if (!canceled) setError(error instanceof Error ? error : new Error(String(error)));
          },
        );

      return () => {
        canceled = true;
      };
    }, [code, renderId]);

    const handlePreviewClick = useCallback(
      (e: React.MouseEvent) => {
        if (!enableImagePreview) return;
        e.stopPropagation();
        setPreviewOpen(true);
      },
      [enableImagePreview],
    );

    const handlePreviewClose = useCallback(() => setPreviewOpen(false), []);

    if (!code) {
      return null;
    }

    if (error) {
      return <ErrorFallback error={error} />;
    }

    if (!svg) {
      return null;
    }

    return (
      <MermaidRenderErrorBoundary code={code} fallback={(err) => <ErrorFallback error={err} />}>
        <Mermaid
          {...props}
          bodyRender={() => (
            <div
              onClick={handlePreviewClick}
              style={{
                cursor: enableImagePreview ? 'zoom-in' : undefined,
                overflow: 'auto',
                padding: 16,
                width: '100%',
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: svg }} style={{ width: '100%' }} />
            </div>
          )}
        >
          {code}
        </Mermaid>
        {previewOpen && <SvgPreviewOverlay onClose={handlePreviewClose} svg={svg} />}
      </MermaidRenderErrorBoundary>
    );
  },
);

MermaidWithErrorBoundary.displayName = 'MermaidWithErrorBoundary';

export default MermaidWithErrorBoundary;
