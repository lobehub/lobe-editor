'use client';

import { type FC, useLayoutEffect } from 'react';

import PortalAnchor from '@/editor-kernel/react/PortalAnchor';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { LinkPlugin } from '../plugin';
import LinkEdit from './components/LinkEdit';
import LinkToolbar from './components/LinkToolbar';
import { useStyles } from './style';
import { ReactLinkPluginProps } from './type';

export const ReactLinkPlugin: FC<ReactLinkPluginProps> = ({
  theme,
  enableHotkey = true,
  validateUrl,
  attributes,
}) => {
  const [editor] = useLexicalComposerContext();
  const { styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(LinkPlugin, {
      attributes,
      enableHotkey,
      theme: theme || styles,
      validateUrl,
    });
  }, [attributes, enableHotkey, styles, theme, validateUrl]);

  return (
    <PortalAnchor>
      <LinkToolbar editor={editor.getLexicalEditor()!} />
      <LinkEdit editor={editor.getLexicalEditor()!} />
    </PortalAnchor>
  );
};

ReactLinkPlugin.displayName = 'ReactLinkPlugin';

export default ReactLinkPlugin;
