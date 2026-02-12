export interface ReactImagePluginProps {
  className?: string;
  defaultBlockImage?: boolean;
  handleRehost?: (url: string) => Promise<{ url: string }>;
  handleUpload?: (file: File) => Promise<{ url: string }>;
  needRehost?: (url: string) => boolean;
  /**
   * Custom file picker for environments where programmatic input.click() is blocked (e.g. Electron).
   * When provided, this will be called instead of triggering the hidden file input.
   */
  onPickFile?: () => Promise<File | null>;
  theme?: {
    blockImage?: string;
    image?: string;
  };
}
