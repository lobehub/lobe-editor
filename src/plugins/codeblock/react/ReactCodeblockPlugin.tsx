import { usePrevious } from 'ahooks';
import { FC, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

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
  const prevStyles = usePrevious(styles);
  const colorReplacementsRef = useRef<AllColorReplacements>(undefined);
  const { isDarkMode } = token;

  const colorReplacements = useMemo(
    (): AllColorReplacements => ({
      'slack-dark': {
        '#4ec9b0': 'var(--color-yellow)',
        '#569cd6': 'var(--color-error)',
        '#6a9955': 'var(--color-gray)',
        '#9cdcfe': 'var(--color-text)',
        '#b5cea8': 'var(--color-purple10)',
        '#c586c0': 'var(--color-info)',
        '#ce9178': 'var(--color-success)',
        '#dcdcaa': 'var(--color-warning)',
        '#e6e6e6': 'var(--color-text)',
      },
      'slack-ochin': {
        '#002339': 'var(--color-text)',
        '#0444ac': 'var(--color-geekblue)',
        '#0991b6': 'var(--color-error)',
        '#174781': 'var(--color-purple10)',
        '#2f86d2': 'var(--color-text)',
        '#357b42': 'var(--color-gray)',
        '#7b30d0': 'var(--color-info)',
        '#7eb233': 'var(--color-warning-text-active)',
        '#a44185': 'var(--color-success)',
        '#dc3eb7': 'var(--color-yellow11)',
      },
    }),
    [token],
  );

  colorReplacementsRef.current = colorReplacements;

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(CodeblockPlugin, {
      colorReplacements: colorReplacementsRef,
      shikiTheme: shikiTheme || {
        dark: 'slack-dark',
        light: 'slack-ochin',
      },
      theme: theme || {
        code: styles.container,
      },
    });
  }, []);

  useEffect(() => {
    if (prevStyles?.container) {
      editor
        .getRootElement()
        ?.querySelectorAll<HTMLElement>('.' + prevStyles?.container)
        .forEach((node) => {
          node.classList.remove(prevStyles.container);
          node.classList.add(styles.container);
        });
    }
  }, [styles, isDarkMode, prevStyles]);

  return null;
};
