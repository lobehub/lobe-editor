import { createStyles } from 'antd-style';
import { rgba } from 'polished';

export const useStyles = createStyles(({ css, token, prefixCls }, size: number) => ({
  button: css`
    &.${prefixCls}-btn {
      flex: none;
      width: ${size}px !important;
      height: ${size}px;
      padding-inline: 0 !important;
    }
  `,
  dropdownButton: css`
    flex: none;
    width: fit-content;
    .${prefixCls}-btn {
      width: ${size * 1.2}px;
      height: ${size}px;
    }
    .${prefixCls}-dropdown-trigger {
      width: ${size * 0.8}px;
      &.${prefixCls}-btn-primary {
        &::before {
          background-color: ${rgba(token.colorBgLayout, 0.1)} !important;
        }
      }
    }
  `,
  dropdownButtonRound: css`
    .${prefixCls}-btn-compact-first-item {
      border-start-start-radius: ${size / 2}px;
      border-end-start-radius: ${size / 2}px;
    }
    .${prefixCls}-dropdown-trigger {
      width: ${size}px;
      border-start-end-radius: ${size / 2}px;
      border-end-end-radius: ${size / 2}px;
    }
  `,
}));
