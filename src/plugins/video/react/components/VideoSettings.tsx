import { Button, Icon, Input, Switch } from '@lobehub/ui';
import { Trash2Icon, UploadIcon } from 'lucide-react';
import { type FC, type KeyboardEvent, useState } from 'react';

import MediaWidthControl from '@/common/MediaWidthControl';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import type { MediaDisplaySize } from '@/utils/mediaDisplaySize';

import { blockStyles } from '../style';

interface VideoSettingsProps {
  canUpload: boolean;
  containerWidth?: number;
  loop: boolean;
  naturalWidth?: number;
  onEmbed: (url: string) => void;
  onLoopChange: (loop: boolean) => void;
  onPickFile: () => void;
  onRemove: () => void;
  onSizeChange: (size: MediaDisplaySize) => void;
  size: MediaDisplaySize;
  src: string;
}

const VideoSettings: FC<VideoSettingsProps> = ({
  canUpload,
  containerWidth,
  loop,
  naturalWidth,
  onEmbed,
  onLoopChange,
  onPickFile,
  onRemove,
  onSizeChange,
  size,
  src,
}) => {
  const t = useTranslation();
  const [url, setUrl] = useState(src);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === 'Enter' && url.trim() && url.trim() !== src) onEmbed(url);
  };

  return (
    <div className={blockStyles.settings}>
      <Input
        onBlur={() => url.trim() && url.trim() !== src && onEmbed(url)}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('video.embedPlaceholder')}
        size="small"
        value={url}
      />
      <MediaWidthControl
        containerWidth={containerWidth}
        naturalWidth={naturalWidth}
        onChange={onSizeChange}
        size={size}
      />
      <label className={blockStyles.settingsRow}>
        <span className={blockStyles.hint}>{t('video.loop')}</span>
        <Switch checked={loop} onChange={onLoopChange} size="small" />
      </label>
      <div className={blockStyles.settingsRow}>
        {canUpload ? (
          <Button icon={<Icon icon={UploadIcon} />} onClick={onPickFile} size="small">
            {t('video.replace')}
          </Button>
        ) : (
          <span />
        )}
        <Button
          danger
          icon={<Icon icon={Trash2Icon} />}
          onClick={onRemove}
          size="small"
          type="text"
        >
          {t('video.remove')}
        </Button>
      </div>
    </div>
  );
};

VideoSettings.displayName = 'VideoSettings';

export default VideoSettings;
