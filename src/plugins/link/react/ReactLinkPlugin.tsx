'use client';

import { message } from 'antd';
import { type FC, useLayoutEffect, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import PortalAnchor from '@/editor-kernel/react/PortalAnchor';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { UNLINK_LINK_COMMAND } from '../command';
import { LinkPlugin } from '../plugin';
import { ILinkService, LinkService } from '../service/i-link-service';
import type { LinkToolbarItem } from '../service/i-link-service';
import LinkEdit, { EDIT_LINK_COMMAND } from './components/LinkEdit';
import LinkToolbar from './components/LinkToolbar';
import { styles } from './style';
import type { ReactLinkDefaultToolbarItemKey, ReactLinkPluginProps } from './type';

async function copyTextToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

function isDefaultToolbarItemEnabled(
  defaultToolbarItems: ReactLinkPluginProps['defaultToolbarItems'],
  key: ReactLinkDefaultToolbarItemKey,
) {
  if (defaultToolbarItems === false) return false;
  if (defaultToolbarItems === true || defaultToolbarItems === undefined) return true;
  return defaultToolbarItems[key] !== false;
}

export const ReactLinkPlugin: FC<ReactLinkPluginProps> = ({
  theme,
  enableHotkey = true,
  validateUrl,
  attributes,
  defaultToolbarItems,
}) => {
  const [enableToolbar, setEnableToolbar] = useState(false);
  const [linkService, setLinkService] = useState<LinkService | null>(null);
  const [editor] = useLexicalComposerContext();
  const t = useTranslation();

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
    setLinkService(linkService);
    setEnableToolbar(linkService.enableLinkToolbar);
    const handleChange = () => {
      setEnableToolbar(linkService.enableLinkToolbar);
    };
    linkService.on('linkToolbarChange', handleChange);
    const unregisterItems: Array<() => void> = [];
    const registerDefaultToolbarItem = (
      key: ReactLinkDefaultToolbarItemKey,
      item: LinkToolbarItem,
    ) => {
      if (!isDefaultToolbarItemEnabled(defaultToolbarItems, key)) return;
      unregisterItems.push(linkService.registerToolbarItem(item));
    };

    registerDefaultToolbarItem('open', {
      icon: 'open',
      key: 'open',
      label: 'link.open',
      onClick: ({ editor, linkNode }) => {
        const linkUrl = editor.getEditorState().read(() => linkNode.getURL());
        window.open(linkUrl, '_blank');
      },
      order: 10,
    });

    registerDefaultToolbarItem('edit', {
      icon: 'edit',
      key: 'edit',
      label: 'link.edit',
      onClick: ({ close, editor, linkDom, linkNode }) => {
        close();
        editor.dispatchCommand(EDIT_LINK_COMMAND, {
          linkNode,
          linkNodeDOM: linkDom,
        });
      },
      order: 20,
    });

    registerDefaultToolbarItem('copy', {
      icon: 'copy',
      key: 'copy',
      label: 'link.copy',
      onClick: async ({ editor, linkNode }) => {
        const linkUrl = editor.getEditorState().read(() => linkNode.getURL());
        await copyTextToClipboard(linkUrl);
        message.success(t('link.copySuccess'));
      },
      order: 30,
    });

    registerDefaultToolbarItem('unlink', {
      icon: 'unlink',
      key: 'unlink',
      label: 'link.unlink',
      onClick: ({ close, editor, linkNode }) => {
        editor.dispatchCommand(UNLINK_LINK_COMMAND, {
          key: linkNode.getKey(),
        });
        close();
      },
      order: 40,
    });

    return () => {
      linkService.off('linkToolbarChange', handleChange);
      unregisterItems.forEach((unregister) => unregister());
    };
  }, [defaultToolbarItems, t]);

  return (
    <PortalAnchor>
      <LinkToolbar
        editor={editor.getLexicalEditor()!}
        enable={enableToolbar}
        service={linkService}
      />
      <LinkEdit editor={editor.getLexicalEditor()!} />
    </PortalAnchor>
  );
};

ReactLinkPlugin.displayName = 'ReactLinkPlugin';

export default ReactLinkPlugin;
