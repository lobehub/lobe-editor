import { cx } from '@lobehub/ui';
import type { ReactNode } from 'react';

import defaultLocale from '@/locale';
import FileBody from '@/plugins/file/react/components/FileBody';
import { styles as fileStyles } from '@/plugins/file/react/style';

export function renderFile(node: Record<string, any>, key: string): ReactNode {
  const { name, fileUrl, status, message, ext, mimeType, size } = node;
  const cls = fileStyles.file;

  if (status === 'error') {
    return (
      <span className={cls} data-file-status="error" key={key}>
        {name}: {message || 'Upload failed'}
      </span>
    );
  }

  if (status === 'pending' || !fileUrl) {
    return (
      <span className={cls} data-file-status="pending" key={key}>
        {name}
      </span>
    );
  }

  return (
    <span className={cx(cls, fileStyles.fileContent)} data-file-status="uploaded" key={key}>
      <FileBody
        downloadLabel={defaultLocale.file.download}
        ext={ext}
        fileUrl={fileUrl}
        mimeType={mimeType}
        name={name}
        previewLabel={defaultLocale.file.preview}
        size={size}
      />
    </span>
  );
}
