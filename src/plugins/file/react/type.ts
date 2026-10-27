import type { FileNode } from '@/plugins/file/node/FileNode';
import type { ILocaleKeys } from '@/types';

export interface FileActionPayload {
  ext?: string;
  fileUrl: string;
  mimeType?: string;
  name: string;
  size?: number;
}

export interface ReactFilePluginProps {
  className?: string;
  handleUpload: (file: File) => Promise<{ url: string }>;
  locale?: Partial<Record<keyof ILocaleKeys, string>>;
  markdownWriter?: (file: FileNode) => string;
  /**
   * Called when the download action is clicked.
   * Defaults to triggering an anchor with the `download` attribute.
   */
  onDownload?: (file: FileActionPayload) => void;
  /**
   * Called when the preview action is clicked.
   * Defaults to opening `fileUrl` in a new tab.
   */
  onPreview?: (file: FileActionPayload) => void;
  theme?: {
    file?: string;
  };
}
