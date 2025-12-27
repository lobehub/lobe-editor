import { createStaticStyles } from 'antd-style';

const prefixCls = 'ant';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  button: css`
    &.${prefixCls}-btn {
      flex: none;
      width: var(--send-button-size, 32px) !important;
      height: var(--send-button-size, 32px);
      padding-inline: 0 !important;
    }
  `,
  disabled: css`
    &.${prefixCls}-btn {
      cursor: default;
      border-color: ${cssVar.colorBorderSecondary};
      background: transparent;
    }

    .${prefixCls}-btn-compact-first-item {
      cursor: default;
      border-color: ${cssVar.colorBorderSecondary};
      background: transparent;
    }
    .${prefixCls}-dropdown-trigger {
      cursor: default;
      border-color: ${cssVar.colorBorderSecondary};
      border-inline-start-color: transparent;
      background: transparent;
    }
  `,
  dropdownButton: css`
    flex: none;
    width: fit-content;
    .${prefixCls}-btn {
      width: calc(var(--send-button-size, 32px) * 1.2);
      height: var(--send-button-size, 32px);
    }
    .${prefixCls}-dropdown-trigger {
      width: calc(var(--send-button-size, 32px) * 0.8);
      &.${prefixCls}-btn-primary {
        &::before {
          background-color: color-mix(in srgb, ${cssVar.colorBgLayout} 10%, transparent) !important;
        }
      }
    }
  `,
  dropdownButtonRound: css`
    .${prefixCls}-btn-compact-first-item {
      border-start-start-radius: calc(var(--send-button-size, 32px) / 2);
      border-end-start-radius: calc(var(--send-button-size, 32px) / 2);
    }
    .${prefixCls}-dropdown-trigger {
      width: var(--send-button-size, 32px);
      border-start-end-radius: calc(var(--send-button-size, 32px) / 2);
      border-end-end-radius: calc(var(--send-button-size, 32px) / 2);
    }
  `,
  loadingButton: css`
    &.${prefixCls}-btn {
      flex: none;
      height: var(--send-button-size, 32px);
      padding-inline: 0 !important;
    }
  `,
}));
