import { Icon, MaterialFileTypeIcon } from '@lobehub/ui';
import { DownloadIcon, EyeIcon } from 'lucide-react';
import { type FC, type MouseEvent, useCallback } from 'react';

import { getFileIconName } from '../../utils/meta';
import { styles } from '../style';
import type { FileActionPayload } from '../type';

export function previewFileInNewTab(file: FileActionPayload) {
  window.open(file.fileUrl, '_blank', 'noopener,noreferrer');
}

export function downloadFileByAnchor(file: FileActionPayload) {
  const anchor = document.createElement('a');
  anchor.href = file.fileUrl;
  anchor.download = file.name;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export interface FileBodyProps {
  downloadLabel: string;
  ext?: string;
  fileUrl?: string;
  mimeType?: string;
  name: string;
  onDownload?: (file: FileActionPayload) => void;
  onPreview?: (file: FileActionPayload) => void;
  previewLabel: string;
  size?: number;
}

const FileBody: FC<FileBodyProps> = ({
  downloadLabel,
  ext,
  fileUrl,
  mimeType,
  name,
  onDownload,
  onPreview,
  previewLabel,
  size,
}) => {
  const getPayload = useCallback(
    (): FileActionPayload => ({ ext, fileUrl: fileUrl || '', mimeType, name, size }),
    [ext, fileUrl, mimeType, name, size],
  );

  const handlePreview = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      event.stopPropagation();
      (onPreview ?? previewFileInNewTab)(getPayload());
    },
    [getPayload, onPreview],
  );

  const handleDownload = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      event.stopPropagation();
      (onDownload ?? downloadFileByAnchor)(getPayload());
    },
    [getPayload, onDownload],
  );

  const stopPropagation = useCallback((event: MouseEvent) => event.stopPropagation(), []);

  return (
    <>
      <MaterialFileTypeIcon
        filename={getFileIconName({ ext, mimeType, name })}
        size={18}
        type={'file'}
        variant={'raw'}
      />
      <span className={styles.fileName}>{name}</span>
      {fileUrl && (
        <span className={styles.fileActions} data-file-actions="">
          <a
            aria-label={previewLabel}
            className={styles.fileAction}
            data-file-action="preview"
            href={fileUrl}
            onClick={handlePreview}
            onMouseDown={stopPropagation}
            rel="noopener noreferrer"
            target="_blank"
            title={previewLabel}
          >
            <Icon icon={EyeIcon} size={14} />
          </a>
          <a
            aria-label={downloadLabel}
            className={styles.fileAction}
            data-file-action="download"
            download={name}
            href={fileUrl}
            onClick={handleDownload}
            onMouseDown={stopPropagation}
            rel="noopener"
            title={downloadLabel}
          >
            <Icon icon={DownloadIcon} size={14} />
          </a>
        </span>
      )}
    </>
  );
};

FileBody.displayName = 'FileBody';

export default FileBody;
