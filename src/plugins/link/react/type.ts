import { LinkAttributes } from '@/plugins/link/node/LinkNode';

export interface ReactLinkPluginProps {
  attributes?: LinkAttributes;
  className?: string;
  theme?: {
    link?: string;
  };
  validateUrl?: (url: string) => boolean;
}
