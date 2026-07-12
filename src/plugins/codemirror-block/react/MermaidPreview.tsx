'use client';

import { Mermaid } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { type FC, useEffect, useState } from 'react';

const MermaidPreview: FC<{ code: string }> = ({ code }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code.trim()) {
      setError(null);
      return;
    }
    let cancelled = false;
    import('mermaid').then(async (mod) => {
      try {
        await mod.default.parse(code);
        if (!cancelled) setError(null);
      } catch (error_) {
        if (!cancelled) setError(error_ instanceof Error ? error_.message : String(error_));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (!code.trim()) return null;

  if (error) {
    return (
      <div
        style={{
          color: cssVar.colorTextDescription,
          fontFamily: cssVar.fontFamilyCode,
          fontSize: 12,
          padding: 16,
          whiteSpace: 'pre-wrap',
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <Mermaid animated={false} theme={'lobe-theme'} variant={'borderless'}>
      {code}
    </Mermaid>
  );
};

MermaidPreview.displayName = 'MermaidPreview';

export default MermaidPreview;
