import { ActionIcon, cx, Popover, Video, type VideoPlayer } from '@lobehub/ui';
import { Settings2Icon } from 'lucide-react';
import {
  type KeyboardEvent,
  memo,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useEditable } from '@/editor-kernel/react/useEditable';
import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import ImageCaption from '@/plugins/image/react/components/ImageCaption';
import type { MediaDisplaySize } from '@/utils/mediaDisplaySize';

import type { VideoNode } from '../../node/VideoNode';
import { getVideoFrameStyle } from '../../utils/frameStyle';
import { blockStyles } from '../style';
import { useVideoSource } from './useVideoSource';
import VideoPlaceholder from './VideoPlaceholder';
import VideoSettings from './VideoSettings';

interface VideoBlockProps {
  className?: string;
  handleUpload?: (file: File) => Promise<{ url: string }>;
  node: VideoNode;
  onPickFile?: () => Promise<File | null>;
}

interface VideoMetrics {
  containerWidth?: number;
  naturalWidth?: number;
}

const INTERACTIVE = 'button, input, select, textarea, [role="slider"], [role="menuitem"]';

const VideoBlock = memo<VideoBlockProps>(({ className, handleUpload, node, onPickFile }) => {
  const [isSelected, setSelected] = useLexicalNodeSelection(node.getKey());
  const { editable } = useEditable();
  const t = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<VideoPlayer>(null);
  const [hovered, setHovered] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [metrics, setMetrics] = useState<VideoMetrics>({});
  const [loadedWidth, setLoadedWidth] = useState<number>();
  const source = useVideoSource({ handleUpload, node, onPickFile });

  const size = node.getDisplaySize();
  const hasVideo = node.status === 'uploaded' && !!node.src;

  useEffect(() => {
    const player = playerRef.current;
    if (!hasVideo || !player) return;
    setLoadedWidth(player.getState().size?.width);
    return player.subscribe((state) => setLoadedWidth(state.size?.width));
  }, [hasVideo, node.src]);

  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (!editable) return;
      event.stopPropagation();
      setSelected(true);
    },
    [editable, setSelected],
  );

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.target as HTMLElement).closest?.(INTERACTIVE)) event.stopPropagation();
  }, []);

  const handleSettingsOpen = useCallback(
    (open: boolean) => {
      if (open) {
        setMetrics({
          containerWidth: rootRef.current?.parentElement?.clientWidth || undefined,
          naturalWidth: playerRef.current?.video?.videoWidth || node.width,
        });
      }
      setSettingsOpen(open);
    },
    [node.width],
  );

  const handleSizeChange = useCallback(
    (next: MediaDisplaySize) => source.update(() => node.setDisplaySize(next)),
    [node, source],
  );

  const handleEmbed = useCallback(
    (url: string) => {
      setSettingsOpen(false);
      source.embed(url);
    },
    [source],
  );

  const fileInput = source.canUpload && !onPickFile && (
    <input
      accept="video/*"
      onChange={source.handleFileChange}
      ref={source.fileInputRef}
      style={{ display: 'none' }}
      type="file"
    />
  );

  return (
    <figure
      className={cx(blockStyles.figure, className)}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      ref={rootRef}
      style={hasVideo ? getVideoFrameStyle(size, loadedWidth ?? node.width) : undefined}
    >
      {fileInput}
      {hasVideo ? (
        <div className={cx(blockStyles.frame, isSelected && 'selected')} onClick={handleClick}>
          <Video
            loop={node.loop}
            poster={node.poster}
            preload="metadata"
            ref={playerRef}
            src={node.src}
          />
          {editable && (hovered || isSelected || settingsOpen) && (
            <div className={blockStyles.actions}>
              <Popover
                arrow={false}
                content={
                  <VideoSettings
                    canUpload={source.canUpload}
                    containerWidth={metrics.containerWidth}
                    loop={node.loop}
                    naturalWidth={metrics.naturalWidth}
                    onEmbed={handleEmbed}
                    onLoopChange={(loop) => source.update(() => node.setLoop(loop))}
                    onPickFile={source.pickFile}
                    onRemove={() => source.update(() => node.remove())}
                    onSizeChange={handleSizeChange}
                    size={size}
                    src={node.src}
                  />
                }
                onOpenChange={handleSettingsOpen}
                open={settingsOpen}
                placement="bottomRight"
                trigger="click"
              >
                <ActionIcon
                  aria-label={t('video.settings')}
                  glass
                  icon={Settings2Icon}
                  size="small"
                  title={t('video.settings')}
                  variant="filled"
                />
              </Popover>
            </div>
          )}
        </div>
      ) : (
        <div onClick={handleClick}>
          <VideoPlaceholder
            canUpload={source.canUpload}
            editable={editable}
            message={node.message}
            onEmbed={source.embed}
            onPickFile={source.pickFile}
            selected={isSelected}
            status={node.status}
          />
        </div>
      )}
      {hasVideo && <ImageCaption active={isSelected} node={node} />}
    </figure>
  );
});

VideoBlock.displayName = 'VideoBlock';

export default VideoBlock;
