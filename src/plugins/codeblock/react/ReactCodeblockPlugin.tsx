import { FC, useEffect, useLayoutEffect, useMemo } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { UPDATE_CODEBLOCK_THEME } from '../command';
import { CodeblockPlugin, CodeblockPluginOptions } from '../plugin';
import { AllColorReplacements } from '../plugin/FacadeShiki';
import { useStyles } from './style';

export interface ReactCodeblockPluginProps extends CodeblockPluginOptions {
  className?: string;
  shikiTheme?: string;
}

export const ReactCodeblockPlugin: FC<ReactCodeblockPluginProps> = ({ theme, shikiTheme }) => {
  const [editor] = useLexicalComposerContext();
  const { styles, theme: token } = useStyles();
  const { isDarkMode } = token;

  const colorReplacements = useMemo(
    (): AllColorReplacements => ({
      'slack-dark': {
        '#4ec9b0': token.yellow,
        '#569cd6': token.colorError,
        '#6a9955': token.gray,
        '#9cdcfe': token.colorText,
        '#b5cea8': token.purple10,
        '#c586c0': token.colorInfo,
        '#ce9178': token.colorSuccess,
        '#dcdcaa': token.colorWarning,
        '#e6e6e6': token.colorText,
      },
      'slack-ochin': {
        '#002339': token.colorText,
        '#0444ac': token.geekblue,
        '#0991b6': token.colorError,
        '#174781': token.purple10,
        '#2f86d2': token.colorText,
        '#357b42': token.gray,
        '#7b30d0': token.colorInfo,
        '#7eb233': token.colorWarningTextActive,
        '#a44185': token.colorSuccess,
        '#dc3eb7': token.yellow11,
      },
    }),
    [token],
  );

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(CodeblockPlugin, {
      colorReplacements,
      shikiTheme: shikiTheme || (isDarkMode ? 'slack-dark' : 'slack-ochin'),
      theme: theme || {
        code: styles.editorCode,
      },
    });
  }, []);

  useEffect(() => {
    editor.dispatchCommand(UPDATE_CODEBLOCK_THEME, {
      theme: shikiTheme || (isDarkMode ? 'slack-dark' : 'slack-ochin'),
    });
  }, [shikiTheme, isDarkMode]);

  return null;
};
