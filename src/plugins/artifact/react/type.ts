export interface ArtifactLabels {
  code?: string;
  preview?: string;
  title?: string;
}

export interface ReactArtifactPluginProps {
  /** Allow scripts inside the sandboxed opaque-origin iframe. Defaults to false. */
  allowScripts?: boolean;
  className?: string;
  labels?: ArtifactLabels;
  previewHeight?: number;
}
