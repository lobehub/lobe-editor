import { LinkAttributes } from '@/plugins/link/node/LinkNode';

export type ReactLinkDefaultToolbarItemKey = 'copy' | 'edit' | 'open' | 'unlink';

export type ReactLinkDefaultToolbarItems =
  | boolean
  | Partial<Record<ReactLinkDefaultToolbarItemKey, boolean>>;

export interface ReactLinkPluginProps {
  attributes?: LinkAttributes;
  className?: string;
  defaultToolbarItems?: ReactLinkDefaultToolbarItems;
  enableHotkey?: boolean;
  theme?: {
    link?: string;
  };
  validateUrl?: (url: string) => boolean;
}
