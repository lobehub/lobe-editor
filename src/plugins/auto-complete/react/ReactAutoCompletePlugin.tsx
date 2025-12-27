'use client';

import { cx } from 'antd-style';
import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { AutoCompletePlugin } from '../plugin';
import { styles } from './style';
import { ReactAutoCompletePluginProps } from './type';

const ReactAutoCompletePlugin: FC<ReactAutoCompletePluginProps> = ({ onAutoComplete, delay }) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(AutoCompletePlugin, {
      delay,
      onAutoComplete,
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
