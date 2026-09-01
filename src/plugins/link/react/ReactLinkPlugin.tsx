'use client';

import { message } from 'antd';
import { type FC, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import PortalAnchor from '@/editor-kernel/react/PortalAnchor';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useEditable } from '@/editor-kernel/react/useEditable';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { UNLINK_LINK_COMMAND } from '../command';
import { LinkPlugin } from '../plugin';
import type { LinkService, LinkToolbarItem } from '../service/i-link-service';
import { ILinkService } from '../service/i-link-service';
import LinkCard from './components/LinkCard';
import LinkEdit, { EDIT_LINK_COMMAND } from './components/LinkEdit';
import LinkIframe from './components/LinkIframe';
import LinkToolbar from './components/LinkToolbar';
import SchemaLink from './components/SchemaLink';
import type { SchemaLinkRendererConfig } from './renderer-registry';
import { LinkReactRendererRegistry, splitReactSchemaRules } from './renderer-registry';
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
  allowedProtocols,
  theme,
  enableHotkey = true,
  validateUrl,
  attributes,
  defaultToolbarItems,
  labels,
  linkEmbedRules,
  normalizeSchemaLinks,
  renderLinkCard,
  renderLinkIframe,
  renderSchema,
  schemaLinkRenderers,
  schemaRules,
  toolbarActions,
}) => {
  const [enableToolbar, setEnableToolbar] = useState(true);
  const [linkService, setLinkService] = useState<LinkService | null>(null);
  const [editor] = useLexicalComposerContext();
  const { editable } = useEditable();
  const t = useTranslation();
  const registeredRef = useRef(false);
  const rendererRegistryRef = useRef(new LinkReactRendererRegistry());
  const splitSchemaRules = useMemo(() => splitReactSchemaRules(schemaRules), [schemaRules]);

  // Plugin registration owns nodes, commands, themes, readers, and writers; keep it one-shot.
  useLayoutEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(LinkPlugin, {
      allowedProtocols,
      attributes,
      decoratorCard: (node, editor) => (
        <LinkCard
          description={node.getDescription()}
          editor={editor}
          icon={node.getIcon()}
          node={node}
          openTarget={node.getOpenTarget()}
          rendererRegistry={rendererRegistryRef.current}
          title={node.getTitle()}
          url={node.getURL()}
        />
      ),
      decoratorIframe: (node, editor) => (
        <LinkIframe
          editor={editor}
          node={node}
          rendererRegistry={rendererRegistryRef.current}
          src={node.getSrc()}
          title={node.getTitle()}
          url={node.getURL()}
        />
      ),
      decoratorSchema: (node, editor) => (
        <SchemaLink editor={editor} node={node} rendererRegistry={rendererRegistryRef.current} />
      ),
      enableHotkey,
      labels,
      linkEmbedRules,
      normalizeSchemaLinks,
      schemaLinkRenderers: getSchemaLinkRendererProtocols(schemaLinkRenderers),
      schemaRules: splitSchemaRules.coreRules,
      theme: theme || styles,
      toolbarActions,
      validateUrl,
    });
  }, [
    allowedProtocols,
    attributes,
    enableHotkey,
    labels,
    linkEmbedRules,
    normalizeSchemaLinks,
    schemaLinkRenderers,
    schemaRules,
    styles,
    theme,
    toolbarActions,
    validateUrl,
  ]);

  useLayoutEffect(() => {
    rendererRegistryRef.current.update({
      renderLinkCard,
      renderLinkIframe,
      renderSchema,
      schemaLinkRenderers,
      schemaRenderers: splitSchemaRules.schemaRenderers,
    });
  }, [
    renderLinkCard,
    renderLinkIframe,
    renderSchema,
    schemaLinkRenderers,
    splitSchemaRules.schemaRenderers,
  ]);

  // Renderers, rules, labels, and toolbar actions are service-level config and can be hot-updated.
  useLayoutEffect(() => {
    if (!registeredRef.current) return;

    const linkService = editor.requireService(ILinkService) as LinkService | null;
    linkService?.updateConfig({
      allowedProtocols,
      labels,
      linkEmbedRules,
      schemaLinkRenderers: getSchemaLinkRendererProtocols(schemaLinkRenderers),
      schemaRules: splitSchemaRules.coreRules,
      toolbarActions,
    });
  }, [
    allowedProtocols,
    editor,
    labels,
    linkEmbedRules,
    schemaLinkRenderers,
    splitSchemaRules.coreRules,
    toolbarActions,
  ]);

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
        enable={enableToolbar && editable}
        linkService={linkService}
      />
      {editable && <LinkEdit editor={editor.getLexicalEditor()!} />}
    </PortalAnchor>
  );
};

ReactLinkPlugin.displayName = 'ReactLinkPlugin';

export default ReactLinkPlugin;

function getSchemaLinkRendererProtocols(
  renderers?: SchemaLinkRendererConfig[],
): Array<{ protocol: string }> | undefined {
  return renderers?.map(({ protocol }) => ({ protocol }));
}
