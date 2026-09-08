import { createStaticStyles, cssVar, cx } from 'antd-style';
import { type CSSProperties, type FC } from 'react';

const styles = createStaticStyles(({ css }) => ({
  icon: css`
    position: relative;
    display: inline-block;
    flex: none;
    line-height: 1;
  `,
  layer: css`
    position: absolute;
    inset: 0;

    display: block;

    width: 100%;
    height: 100%;
  `,
  spinner: css`
    transform-origin: 50% 50%;
    animation: send-button-stop-spin 1s linear infinite;

    @keyframes send-button-stop-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
}));

interface StopIconProps {
  size?: string | number;
  style?: CSSProperties;
}

const StopIcon: FC<StopIconProps> = ({ size = '1.5em', style }) => {
  return (
    <span className={cx('anticon', styles.icon)} style={{ height: size, width: size, ...style }}>
      <svg
        className={styles.layer}
        fill="none"
        height={size}
        viewBox="0 0 1024 1024"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="512" cy="512" r="426" stroke={cssVar.colorBorder} strokeWidth="72" />
        <rect fill="currentColor" height="252" rx="24" ry="24" width="252" x="386" y="386" />
      </svg>
      <svg
        className={cx(styles.layer, styles.spinner)}
        fill="none"
        height={size}
        viewBox="0 0 1024 1024"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M938.667 512C938.667 276.359 747.64 85.333 512 85.333"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="73"
        />
      </svg>
    </span>
  );
};

export default StopIcon;
