export interface ReactImagePluginProps {
  className?: string;
  defaultBlockImage?: boolean;
  handleRehost?: (url: string) => Promise<{ url: string }>;
  handleUpload?: (file: File) => Promise<{ url: string }>;
  needRehost?: (url: string) => boolean;
  theme?: {
    blockImage?: string;
    image?: string;
  };
}
