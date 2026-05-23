'use client';

import { cx } from 'antd-style';
import { type FC, useLayoutEffect, useRef } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { createDebugLogger } from '@/utils/debug';

import { AutoCompletePlugin } from '../plugin';
import { styles } from './style';
import { ReactAutoCompletePluginProps } from './type';

const logger = createDebugLogger('react-plugin', 'auto-complete');

const ReactAutoCompletePlugin: FC<ReactAutoCompletePluginProps> = ({
  delay,
  onAutoComplete,
  onSuggestionAccepted,
  onSuggestionRejected,
}) => {
  const [editor] = useLexicalComposerContext();
  const propsRef = useRef<ReactAutoCompletePluginProps>({
    delay,
    onAutoComplete,
    onSuggestionAccepted,
    onSuggestionRejected,
  });

  propsRef.current = {
    delay,
    onAutoComplete,
    onSuggestionAccepted,
    onSuggestionRejected,
  };

  useLayoutEffect(() => {
    editor.registerPlugin(AutoCompletePlugin, {
      delay,
      onAutoComplete: async (opt) => {
        try {
          return (await propsRef.current.onAutoComplete?.(opt)) ?? null;
        } catch (error) {
          logger.warn('Auto-complete onAutoComplete callback failed:', error);
          return null;
        }
      },
      onSuggestionAccepted: (info) => {
        try {
          propsRef.current.onSuggestionAccepted?.(info);
        } catch (error) {
          logger.warn('Auto-complete onSuggestionAccepted callback failed:', error);
        }
      },
      onSuggestionRejected: (info) => {
        try {
          propsRef.current.onSuggestionRejected?.(info);
        } catch (error) {
          logger.warn('Auto-complete onSuggestionRejected callback failed:', error);
        }
      },
      theme: {
        placeholderBlock: cx(styles.placeholderBlock),
        placeholderInline: cx(styles.placeholderInline),
      },
    });
  }, []);

  return null;
};

ReactAutoCompletePlugin.displayName = 'ReactAutoCompletePlugin';

export default ReactAutoCompletePlugin;
