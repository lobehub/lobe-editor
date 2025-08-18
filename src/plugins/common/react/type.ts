import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { CommonPluginOptions } from '@/plugins/common';
import type { IEditor } from '@/types';

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
