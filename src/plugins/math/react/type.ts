import type { FC, ReactNode } from 'react';

export interface ReactMathPluginProps {
  className?: string;
  /** 自定义渲染组件，接收 MathEditorContent 作为子节点 */
  renderComp?: FC<{ children: ReactNode; open?: boolean }>;
  theme?: {
    mathBlock?: string;
    mathInline?: string;
  };
}
