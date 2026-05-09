'use client';

import { Mermaid } from '@lobehub/ui';
import mermaid from 'mermaid';
import React, { Component, type ReactNode, memo, useEffect, useId, useState } from 'react';

// ============================================================================
// Mermaid 渲染错误边界（Class 组件，才能捕获子组件渲染错误）
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
    // 代码变化时重置错误状态
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
      <div
        style={{
          color: '#ff4d4f',
          fontSize: 14,
          fontWeight: 500,
          marginBottom: 8,
        }}
      >
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
// 带完整错误处理的 Mermaid 包装组件
// ============================================================================
interface MermaidWithErrorBoundaryProps {
  animated?: boolean;
  children: string;
  copyable?: boolean;
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
const MermaidWithErrorBoundary = memo<MermaidWithErrorBoundaryProps>(({ children, ...props }) => {
  const code = children.trim();
  const renderId = `mermaid-validate-${useId().replaceAll(':', '')}`;
  const [error, setError] = useState<Error | null>(null);
  const [svg, setSvg] = useState<string>('');

  // 自己完成渲染：@lobehub/ui 内部会吞掉 render 错误并显示空占位图。
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
            dangerouslySetInnerHTML={{ __html: svg }}
            style={{ overflow: 'auto', padding: 16, width: '100%' }}
          />
        )}
      >
        {code}
      </Mermaid>
    </MermaidRenderErrorBoundary>
  );
});

MermaidWithErrorBoundary.displayName = 'MermaidWithErrorBoundary';

export default MermaidWithErrorBoundary;
