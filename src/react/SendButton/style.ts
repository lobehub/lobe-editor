import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  button: css`
    flex: none;
    width: var(--send-button-size, 32px) !important;
    height: var(--send-button-size, 32px) !important;
    padding-inline: 0 !important;
  `,
  disabled: css`
    cursor: default;
    border-color: ${cssVar.colorBorderSecondary};
    background: transparent;
  `,
  loadingButton: css`
    flex: none;
    height: var(--send-button-size, 32px) !important;
    padding-inline: 0 !important;
  `,
  splitButton: css`
    flex: none;
    width: fit-content;

    & > :where(button, a) {
      height: var(--send-button-size, 32px) !important;
      padding-inline: 0 !important;
    }

    & > :where(button, a):first-of-type {
      width: calc(var(--send-button-size, 32px) * 1.2) !important;
    }

    & > :where(button, a):last-of-type {
      width: calc(var(--send-button-size, 32px) * 0.8) !important;
    }
  `,
  splitButtonDisabled: css`
    opacity: 1;

    & > :where(button, a) {
      cursor: default;
      border-color: ${cssVar.colorBorderSecondary};
      background: transparent;
    }
  `,
  splitButtonRound: css`
    & > :where(button, a):first-of-type {
      border-start-start-radius: calc(var(--send-button-size, 32px) / 2);
      border-end-start-radius: calc(var(--send-button-size, 32px) / 2);
    }

    & > :where(button, a):last-of-type {
      width: var(--send-button-size, 32px) !important;
      border-start-end-radius: calc(var(--send-button-size, 32px) / 2);
      border-end-end-radius: calc(var(--send-button-size, 32px) / 2);
    }
  `,
}));
