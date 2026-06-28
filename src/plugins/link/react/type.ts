import { LinkAttributes } from '@/plugins/link/node/LinkNode';
import type { LinkEmbedRule, LinkLabels } from '@/plugins/link/service/i-link-service';

import type {
  LinkCardRenderer,
  LinkIframeRenderer,
  LinkToolbarAction,
  ReactSchemaRule,
  SchemaLinkRendererConfig,
  SchemaRenderer,
} from './renderer-registry';

export interface ReactLinkPluginProps {
  allowedProtocols?: string[];
  /** Registration-time option. Remount ReactLinkPlugin to apply changes. */
  attributes?: LinkAttributes;
  className?: string;
  /** Registration-time option. Remount ReactLinkPlugin to apply changes. */
  enableHotkey?: boolean;
  labels?: Partial<LinkLabels>;
  linkEmbedRules?: LinkEmbedRule[];
  /** Registration-time normalization strategy. Defaults to true for legacy compatibility. */
  normalizeSchemaLinks?: boolean;
  renderLinkCard?: LinkCardRenderer;
  renderLinkIframe?: LinkIframeRenderer;
  renderSchema?: SchemaRenderer;
  schemaLinkRenderers?: SchemaLinkRendererConfig[];
  schemaRules?: ReactSchemaRule[];
  /** Registration-time option. Remount ReactLinkPlugin to apply changes. */
  theme?: {
    link?: string;
    linkCard?: string;
    linkIframe?: string;
    schemaLink?: string;
  };
  toolbarActions?: LinkToolbarAction[];
  /** Registration-time option. Remount ReactLinkPlugin to apply changes. */
  validateUrl?: (url: string) => boolean;
}
