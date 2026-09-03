import type { FC } from 'react';

interface ArtifactPreviewProps {
  allowScripts: boolean;
  height: number;
  html: string;
  title: string;
}

const ArtifactPreview: FC<ArtifactPreviewProps> = ({ allowScripts, height, html, title }) => (
  <iframe
    allow=""
    className="artifact-frame"
    referrerPolicy="no-referrer"
    sandbox={allowScripts ? 'allow-scripts' : ''}
    srcDoc={html}
    style={{ height: `var(--lobe-artifact-preview-height, ${height}px)` }}
    title={`${title} preview`}
  />
);

ArtifactPreview.displayName = 'ArtifactPreview';

export default ArtifactPreview;
