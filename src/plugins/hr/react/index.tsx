import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { HRPlugin } from '../plugin';
import './index.less';

export interface ReactHRPluginProps {
  className?: string;
}

export const ReactHRPlugin: FC<ReactHRPluginProps> = () => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    console.info('ReactHRPlugin: Initializing Codeblock Plugin');
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(HRPlugin, {
      decorator() {
        return <hr className="editor_horizontalRule" />;
      },
    });
  }, []);

  return null;
};
