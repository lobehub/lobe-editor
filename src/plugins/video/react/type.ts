export interface ReactVideoPluginProps {
  className?: string;
  /**
   * Upload handler for picked, dropped or pasted `video/*` files.
   * Without it, video files fall through to other upload handlers and the Upload button is hidden.
   */
  handleUpload?: (file: File) => Promise<{ url: string }>;
  /**
   * Custom file picker for environments where programmatic input.click() is blocked (e.g. Electron).
   */
  onPickFile?: () => Promise<File | null>;
  theme?: {
    video?: string;
  };
}
