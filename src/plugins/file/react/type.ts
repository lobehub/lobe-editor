import { II18nKeys } from '@/editor-kernel/types';
import { FileNode } from '@/plugins/file/node/FileNode';

export interface ReactFilePluginProps {
  className?: string;
  handleUpload: (file: File) => Promise<{ url: string }>;
  i18n?: Partial<Record<keyof II18nKeys, string>>;
  markdownWriter?: (file: FileNode) => string;
  theme?: {
    file?: string;
  };
}
