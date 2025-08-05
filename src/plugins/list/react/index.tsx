import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { ListPlugin } from '../plugin';
import './index.less';

export interface ReactListPluginProps {
  className?: string;
}

export const ReactListPlugin: FC<ReactListPluginProps> = () => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    console.info('ReactListPlugin: Initializing List Plugin');
    editor.registerPlugin(ListPlugin);
  }, []);

  return null;
};
