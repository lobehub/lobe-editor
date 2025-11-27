'use client';

import { type FC, useLayoutEffect, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import PortalAnchor from '@/editor-kernel/react/PortalAnchor';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { LinkPlugin } from '../plugin';
import { ILinkService, LinkService } from '../service/i-link-service';
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
  const [enableToolbar, setEnableToolbar] = useState(false);
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

  useLexicalEditor(() => {
    const linkService = editor.requireService(ILinkService) as LinkService;
    setEnableToolbar(linkService.enableLinkToolbar);
    const handleChange = () => {
      setEnableToolbar(linkService.enableLinkToolbar);
    };
    linkService.on('linkToolbarChange', handleChange);
    return () => {
      linkService.off('linkToolbarChange', handleChange);
    };
  }, []);

  return (
    <PortalAnchor>
      <LinkToolbar editor={editor.getLexicalEditor()!} enable={enableToolbar} />
      <LinkEdit editor={editor.getLexicalEditor()!} />
    </PortalAnchor>
  );
};

ReactLinkPlugin.displayName = 'ReactLinkPlugin';

export default ReactLinkPlugin;
