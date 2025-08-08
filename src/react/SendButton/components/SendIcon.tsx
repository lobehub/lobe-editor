'use client';

import { CSSProperties, memo } from 'react';

const SendIcon = memo<{
  size?: string | number;
  style?: CSSProperties;
}>(({ size = '1em', style }) => {
  return (
    <svg
      className={'anticon'}
      fill="currentColor"
      fillRule="evenodd"
      height={size}
      style={{ flex: 'none', lineHeight: 1, ...style }}
      viewBox="0 0 14 14"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M.743 3.773c-.818-.555-.422-1.834.567-1.828l11.496.074a1 1 0 01.837 1.538l-6.189 9.689c-.532.833-1.822.47-1.842-.518L5.525 8.51a1 1 0 01.522-.9l1.263-.686a.808.808 0 00-.772-1.42l-1.263.686a1 1 0 01-1.039-.051L.743 3.773z" />
    </svg>
  );
});

export default SendIcon;
