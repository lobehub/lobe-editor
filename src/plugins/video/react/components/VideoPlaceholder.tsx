import { Button, cx, Icon, Input } from '@lobehub/ui';
import { LinkIcon, LoaderCircleIcon, TriangleAlertIcon, UploadIcon, VideoIcon } from 'lucide-react';
import { type FC, type KeyboardEvent, type SyntheticEvent, useState } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import type { VideoStatus } from '../../node/VideoNode';
import { blockStyles } from '../style';

interface VideoPlaceholderProps {
  canUpload: boolean;
  editable: boolean;
  message?: string;
  onEmbed: (url: string) => void;
  onPickFile: () => void;
  selected: boolean;
  status: VideoStatus;
}

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

const VideoPlaceholder: FC<VideoPlaceholderProps> = ({
  canUpload,
  editable,
  message,
  onEmbed,
  onPickFile,
  selected,
  status,
}) => {
  const t = useTranslation();
  const [embedding, setEmbedding] = useState(false);
  const [url, setUrl] = useState('');

  if (status === 'loading') {
    return (
      <div className={blockStyles.placeholder}>
        <Icon icon={LoaderCircleIcon} size={24} spin />
        <span className={blockStyles.hint}>{t('video.uploading')}</span>
      </div>
    );
  }

  const isError = status === 'error';

  const submit = () => {
    if (!url.trim()) return;
    onEmbed(url);
    setEmbedding(false);
    setUrl('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === 'Enter') submit();
    if (event.key === 'Escape') setEmbedding(false);
  };

  return (
    <div className={cx(blockStyles.placeholder, selected && 'selected')}>
      <Icon icon={isError ? TriangleAlertIcon : VideoIcon} size={24} />
      <span className={blockStyles.placeholderTitle}>
        {isError ? t('video.error') : t('video.add')}
      </span>
      {isError && message && <span className={blockStyles.hint}>{message}</span>}
      {editable && !embedding && (
        <div className={blockStyles.settingsRow}>
          {canUpload && (
            <Button icon={<Icon icon={UploadIcon} />} onClick={onPickFile} size="small" type="fill">
              {isError ? t('video.replace') : t('video.upload')}
            </Button>
          )}
          <Button icon={<Icon icon={LinkIcon} />} onClick={() => setEmbedding(true)} size="small">
            {t('video.embed')}
          </Button>
        </div>
      )}
      {editable && embedding && (
        <div className={blockStyles.embedRow}>
          <Input
            autoFocus
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={handleKeyDown}
            onMouseDown={stopPropagation}
            onPaste={stopPropagation}
            placeholder={t('video.embedPlaceholder')}
            size="small"
            value={url}
          />
          <Button onClick={submit} size="small" type="fill">
            {t('video.embedConfirm')}
          </Button>
        </div>
      )}
      {!isError && <span className={blockStyles.hint}>{t('video.formats')}</span>}
    </div>
  );
};

VideoPlaceholder.displayName = 'VideoPlaceholder';

export default VideoPlaceholder;
