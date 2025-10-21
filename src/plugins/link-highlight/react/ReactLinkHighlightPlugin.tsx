import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { LinkHighlightPlugin } from '../plugin';
import { useStyles } from './style';
import { ReactLinkHighlightPluginProps } from './type';

const ReactLinkHighlightPlugin: FC<ReactLinkHighlightPluginProps> = ({
  className,
  enableHotkey = true,
  enablePasteAutoHighlight = true,
}) => {
  const [editor] = useLexicalComposerContext();
  const { cx, styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(LinkHighlightPlugin, {
      enableHotkey,
      enablePasteAutoHighlight,
      theme: cx(styles.linkHighlight, className),
    });
  }, [className, cx, enableHotkey, enablePasteAutoHighlight, editor, styles.linkHighlight]);

  return null;
};

ReactLinkHighlightPlugin.displayName = 'ReactLinkHighlightPlugin';

export default ReactLinkHighlightPlugin;
