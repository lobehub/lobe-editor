/* eslint-disable @typescript-eslint/no-use-before-define */
'use client';

import { type FC, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import PortalAnchor from '@/editor-kernel/react/PortalAnchor';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useEditable } from '@/editor-kernel/react/useEditable';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { LinkPlugin } from '../plugin';
import { ILinkService, LinkService } from '../service/i-link-service';
import LinkCard from './components/LinkCard';
import LinkEdit from './components/LinkEdit';
import LinkIframe from './components/LinkIframe';
import LinkToolbar from './components/LinkToolbar';
import SchemaLink from './components/SchemaLink';
import {
  LinkReactRendererRegistry,
  SchemaLinkRendererConfig,
  splitReactSchemaRules,
} from './renderer-registry';
import { styles } from './style';
import { ReactLinkPluginProps } from './type';

/* eslint-disable @typescript-eslint/no-use-before-define */

/* eslint-disable @typescript-eslint/no-use-before-define */

export const ReactLinkPlugin: FC<ReactLinkPluginProps> = ({
  allowedProtocols,
  theme,
  enableHotkey = true,
  validateUrl,
  attributes,
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
    return () => {
      linkService.off('linkToolbarChange', handleChange);
    };
  }, []);

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
