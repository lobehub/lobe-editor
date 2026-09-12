export interface ArtifactLabels {
  code?: string;
  codeOnly?: string;
  previewOnly?: string;
  preview?: string;
  splitView?: string;
  title?: string;
  viewMode?: string;
}

export interface ReactArtifactPluginProps {
  /** Allow scripts inside the sandboxed opaque-origin iframe. Defaults to false. */
  allowScripts?: boolean;
  className?: string;
  labels?: ArtifactLabels;
  previewHeight?: number;
}
