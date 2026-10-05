import type { FC, Ref } from 'react';

interface ArtifactPreviewProps {
  allowScripts: boolean;
  height: number;
  html: string;
  iframeRef?: Ref<HTMLIFrameElement>;
  title: string;
}

const ArtifactPreview: FC<ArtifactPreviewProps> = ({
  allowScripts,
  height,
  html,
  iframeRef,
  title,
}) => (
  <iframe
    allow=""
    className="artifact-frame"
    data-hole-interactive="true"
    ref={iframeRef}
    referrerPolicy="no-referrer"
    sandbox={allowScripts ? 'allow-scripts' : ''}
    srcDoc={html}
    style={{ height: `var(--lobe-artifact-preview-height, ${height}px)` }}
    tabIndex={0}
    title={`${title} preview`}
  />
);

ArtifactPreview.displayName = 'ArtifactPreview';

export default ArtifactPreview;
