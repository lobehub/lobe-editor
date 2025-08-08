import { useTheme } from 'antd-style';
import { CSSProperties, memo } from 'react';

const StopIcon = memo<{
  size?: string | number;
  style?: CSSProperties;
}>(({ size = '1.5em', style }) => {
  const theme = useTheme();
  return (
    <svg
      className={'anticon'}
      color="currentColor"
      height={size}
      style={{ flex: 'none', lineHeight: 1, ...style }}
      viewBox="0 0 1024 1024"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none">
        <circle cx="512" cy="512" fill="none" r="426" stroke={theme.colorBorder} strokeWidth="72" />
        <rect fill="currentColor" height="252" rx="24" ry="24" width="252" x="386" y="386" />
        <path
          d="M938.667 512C938.667 276.359 747.64 85.333 512 85.333"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="73"
        >
          <animateTransform
            attributeName="transform"
            dur="1s"
            from="0 512 512"
            repeatCount="indefinite"
            to="360 512 512"
            type="rotate"
          />
        </path>
      </g>
    </svg>
  );
});

export default StopIcon;
