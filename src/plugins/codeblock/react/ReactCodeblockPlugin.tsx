'use client';

import { usePrevious } from 'ahooks';
import { FC, useEffect, useLayoutEffect, useRef } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { CodeblockPlugin } from '../plugin';
import { AllColorReplacements } from '../plugin/FacadeShiki';
import { colorReplacements, useStyles } from './style';
import type { ReactCodeblockPluginProps } from './type';

export const ReactCodeblockPlugin: FC<ReactCodeblockPluginProps> = ({ theme, shikiTheme }) => {
  const [editor] = useLexicalComposerContext();
  const { styles, theme: token } = useStyles();
  const { isDarkMode } = token;
  const prevStyles = usePrevious(styles);
  const colorReplacementsRef = useRef<AllColorReplacements>(colorReplacements);

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(CodeblockPlugin, {
      colorReplacements: colorReplacementsRef,
      shikiTheme: shikiTheme || {
        dark: 'slack-dark',
        light: 'slack-ochin',
      },
      theme: theme || styles,
    });
  }, []);

  useEffect(() => {
    if (prevStyles?.code) {
      editor
        .getRootElement()
        ?.querySelectorAll<HTMLElement>('.' + prevStyles?.code)
        .forEach((node) => {
          node.classList.remove(prevStyles.code);
          node.classList.add(styles.code);
        });
    }
    editor.updateTheme('code', styles.code);
  }, [styles, isDarkMode, prevStyles]);

  return null;
};

ReactCodeblockPlugin.displayName = 'ReactCodeblockPlugin';

export default ReactCodeblockPlugin;
