import { createStaticStyles, cssVar, cx } from 'antd-style';
import { type CSSProperties, type FC } from 'react';

const styles = createStaticStyles(({ css }) => ({
  icon: css`
    flex: none;
    line-height: 1;
  `,
}));

interface StopIconProps {
  size?: string | number;
  style?: CSSProperties;
}

const StopIcon: FC<StopIconProps> = ({ size = '1.5em', style }) => {
  return (
    <svg
      className={cx('anticon', styles.icon)}
      color="currentColor"
      height={size}
      style={style}
      viewBox="0 0 1024 1024"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none">
        <circle
          cx="512"
          cy="512"
          fill="none"
          r="426"
          stroke={cssVar.colorBorder}
          strokeWidth="72"
        />
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
};

export default StopIcon;
