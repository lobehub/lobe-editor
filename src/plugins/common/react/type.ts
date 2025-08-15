import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { IEditor } from '@/editor-kernel';
import { CommonPluginOptions } from '@/plugins/common';

export interface ReactEditorContentProps {
  content: any;
  placeholder?: ReactNode;
  type: string;
}

export interface ReactPlainTextProps {
  children: ReactElement<ReactEditorContentProps>;
  className?: string;
  onChange?: (editor: IEditor) => void;
  style?: CSSProperties;
  theme?: CommonPluginOptions['theme'] & {
    fontSize?: number;
    headerMultiple?: number;
    lineHeight?: number;
    marginMultiple?: number;
  };
  variant?: 'default' | 'chat';
}
