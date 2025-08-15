import { FileNode } from '@/plugins/file/node/FileNode';

export interface ReactFilePluginProps {
  className?: string;
  handleUpload: (file: File) => Promise<{ url: string }>;
  markdownWriter?: (file: FileNode) => string;
  theme?: {
    file?: string;
  };
}
