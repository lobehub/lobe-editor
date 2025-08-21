import type {
  CSSProperties,
  CompositionEvent,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  ReactElement,
  ReactNode,
} from 'react';

import type { CommonPluginOptions } from '@/plugins/common';
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
  onBlur?: (props: { editor: IEditor; event: FocusEvent<HTMLDivElement> }) => void;
  onChange?: (editor: IEditor) => void;
  onCompositionEnd?: (props: { editor: IEditor; event: CompositionEvent<HTMLDivElement> }) => void;
  onCompositionStart?: (props: {
    editor: IEditor;
    event: CompositionEvent<HTMLDivElement>;
  }) => void;
  onContextMenu?: (props: { editor: IEditor; event: MouseEvent<HTMLDivElement> }) => void;
  onFocus?: (props: { editor: IEditor; event: FocusEvent<HTMLDivElement> }) => void;
  onKeyDown?: (props: { editor: IEditor; event: KeyboardEvent<HTMLDivElement> }) => void;
  onPressEnter?: (props: { editor: IEditor; event: KeyboardEvent<HTMLDivElement> }) => void;
  style?: CSSProperties;
  theme?: CommonPluginOptions['theme'] & {
    fontSize?: number;
    headerMultiple?: number;
    lineHeight?: number;
    marginMultiple?: number;
  };
  variant?: 'default' | 'chat';
}
