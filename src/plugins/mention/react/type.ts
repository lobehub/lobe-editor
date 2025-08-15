import type { MentionNode } from '@/plugins/mention/node/MentionNode';

export interface ReactMentionPluginProps {
  className?: string;
  markdownWriter?: (file: MentionNode) => string;
  theme?: {
    mention?: string;
  };
}
