import { Video } from '@lobehub/ui';
import type { ReactNode } from 'react';

import { styles as imageComponentStyles } from '@/plugins/image/react/components/style';
import { blockStyles } from '@/plugins/video/react/style';
import { isSafeVideoSrc } from '@/plugins/video/utils/attributes';
import { getVideoFrameStyle } from '@/plugins/video/utils/frameStyle';
import { resolveMediaDisplaySize } from '@/utils/mediaDisplaySize';

export function renderVideo(node: Record<string, any>, key: string): ReactNode {
  if (!isSafeVideoSrc(node.src)) return null;
  const caption = typeof node.caption === 'string' ? node.caption : '';
  const style = getVideoFrameStyle(
    resolveMediaDisplaySize({ displayWidth: node.displayWidth, fixedWidth: node.fixedWidth }),
    typeof node.width === 'number' ? node.width : undefined,
  );
  return (
    <figure className={blockStyles.figure} key={key} style={style}>
      <Video
        loop={node.loop === true}
        poster={isSafeVideoSrc(node.poster) ? node.poster : undefined}
        preload="metadata"
        src={node.src}
      />
      {caption && <figcaption className={imageComponentStyles.caption}>{caption}</figcaption>}
    </figure>
  );
}
