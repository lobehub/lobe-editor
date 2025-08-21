import type {
  CSSProperties,
  CompositionEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactElement,
  ReactNode,
} from 'react';

import { CommonPluginOptions } from '@/plugins/common';
import type { IEditor } from '@/types';

export interface ReactEditorContentProps {
  content: any;
  placeholder?: ReactNode;
  type: string;
}

export interface ReactPlainTextProps {
  autoFocus?: boolean;
  children: ReactElement<ReactEditorContentProps>;
  className?: string;
  onBlur?: FocusEventHandler<HTMLDivElement>;
  onChange?: (editor: IEditor) => void;
  onCompositionEnd?: CompositionEventHandler<HTMLDivElement>;
  onCompositionStart?: CompositionEventHandler<HTMLDivElement>;
  onContextMenu?: MouseEventHandler<HTMLDivElement>;
  onFocus?: FocusEventHandler<HTMLDivElement>;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  style?: CSSProperties;
  theme?: CommonPluginOptions['theme'] & {
    fontSize?: number;
    headerMultiple?: number;
    lineHeight?: number;
    marginMultiple?: number;
  };
  variant?: 'default' | 'chat';
}
