'use client';

import { ActionIcon } from '@lobehub/ui';
import { Check, CopyIcon } from 'lucide-react';
import { FC, useState } from 'react';

const CopyButton: FC<{
  onCopy: () => void;
}> = ({ onCopy }) => {
  const [copied, setCopied] = useState(false);
  return (
    <ActionIcon
      active={copied}
      className={'cm-hidden-actions'}
      icon={copied ? Check : CopyIcon}
      onClick={() => {
        setCopied(true);
        onCopy();
        setTimeout(() => setCopied(false), 1000);
      }}
      size={'small'}
      title={'Copy'}
    />
  );
};

CopyButton.displayName = 'CopyButton';

export default CopyButton;
