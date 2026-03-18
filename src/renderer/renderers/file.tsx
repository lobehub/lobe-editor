import type { ReactNode } from 'react';

import { styles as fileStyles } from '@/plugins/file/react/style';

export function renderFile(node: Record<string, any>, key: string): ReactNode {
  const { name, fileUrl, status, message } = node;
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
    <a className={cls} download={name} href={fileUrl} key={key}>
      {name}
    </a>
  );
}
