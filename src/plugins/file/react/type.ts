import type { BlockFileNode } from '@/plugins/file/node/BlockFileNode';
import type { FileNode } from '@/plugins/file/node/FileNode';
import type { ILocaleKeys } from '@/types';

export interface ReactFilePluginProps {
  className?: string;
  defaultBlockFile?: boolean;
  handleUpload: (file: File) => Promise<{ url: string }>;
  locale?: Partial<Record<keyof ILocaleKeys, string>>;
  markdownWriter?: (file: FileNode | BlockFileNode) => string;
  theme?: {
    file?: string;
  };
}
