import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { HRPlugin } from '../plugin';
import { useStyles } from './style';

export interface ReactHRPluginProps {
  className?: string;
}

export const ReactHRPlugin: FC<ReactHRPluginProps> = () => {
  const [editor] = useLexicalComposerContext();
  const { styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(HRPlugin, {
      className: styles,
      decorator() {
        return null;
      },
    });
  }, []);

  return null;
};
