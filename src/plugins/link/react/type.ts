import { LinkAttributes } from '@/plugins/link/node/LinkNode';
import type { SchemaLinkRendererConfig } from '@/plugins/link/service/i-link-service';

export interface ReactLinkPluginProps {
  allowedProtocols?: string[];
  attributes?: LinkAttributes;
  className?: string;
  enableHotkey?: boolean;
  schemaLinkRenderers?: SchemaLinkRendererConfig[];
  theme?: {
    link?: string;
  };
  validateUrl?: (url: string) => boolean;
}
