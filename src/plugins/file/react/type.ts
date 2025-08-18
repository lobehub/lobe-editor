import { FileNode } from '@/plugins/file/node/FileNode';
import type { ILocaleKeys } from '@/types';

export interface ReactFilePluginProps {
  className?: string;
  handleUpload: (file: File) => Promise<{ url: string }>;
  locale?: Partial<Record<keyof ILocaleKeys, string>>;
  markdownWriter?: (file: FileNode) => string;
  theme?: {
    file?: string;
  };
}
