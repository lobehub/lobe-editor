'use client';

import { ActionIcon } from '@lobehub/ui';
import { Check, CopyIcon } from 'lucide-react';
import { type FC, useState } from 'react';

import type { CopyButtonProps } from '../types';

export const CopyButton: FC<CopyButtonProps> = ({ onCopy, labels, className }) => {
  const [copied, setCopied] = useState(false);
  return (
    <ActionIcon
      active={copied}
      className={className ?? 'cm-hidden-actions'}
      icon={copied ? Check : CopyIcon}
      onClick={() => {
        setCopied(true);
        onCopy();
        setTimeout(() => setCopied(false), 1000);
      }}
      size={'small'}
      title={labels?.copy ?? 'Copy'}
    />
  );
};

CopyButton.displayName = 'CopyButton';
