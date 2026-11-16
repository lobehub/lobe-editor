import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  block: css`
    position: relative;
    margin-block: calc(var(--lobe-markdown-margin-multiple, 1) * 0.5em);
    border-radius: ${cssVar.borderRadiusLG};

    &.selected {
      outline: 2px solid ${cssVar.yellow};
      outline-offset: 2px;
    }

    &:hover .chart-toolbar,
    &.selected .chart-toolbar {
      opacity: 1;
    }
  `,
  canvasPlaceholder: css`
    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: ${cssVar.borderRadius};

    font-size: 13px;
    color: ${cssVar.colorTextQuaternary};

    background: ${cssVar.colorFillQuaternary};
  `,
  error: css`
    display: flex;
    flex-direction: column;
    gap: 8px;

    padding: 12px;
    border: 1px solid ${cssVar.colorErrorBorder};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorErrorBg};
  `,
  errorMessage: css`
    font-size: 13px;
    color: ${cssVar.colorError};
  `,
  errorRaw: css`
    overflow: auto;

    max-height: 200px;
    margin: 0;

    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    white-space: pre-wrap;
  `,
  errorTitle: css`
    font-weight: 600;
    color: ${cssVar.colorError};
  `,
  footer: css`
    display: flex;
    flex-direction: column;
    gap: 2px;

    margin-block-start: 8px;

    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
  `,
  header: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-block-end: 12px;
  `,
  sourceEditor: css`
    display: flex;
    flex-direction: column;
    gap: 8px;

    padding: 8px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorBgContainer};
  `,
  sourceTextArea: css`
    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
  `,
  subtitle: css`
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
  title: css`
    font-size: 15px;
    font-weight: 600;
    color: ${cssVar.colorText};
  `,
  toolbar: css`
    position: absolute;
    z-index: 1;
    inset-block-start: 8px;
    inset-inline-end: 8px;

    display: flex;
    gap: 2px;
    align-items: center;

    padding: 2px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};

    opacity: 0;
    background: ${cssVar.colorBgElevated};
    box-shadow: ${cssVar.boxShadowTertiary};

    transition: opacity 0.2s;

    &:focus-within,
    &[data-open='true'] {
      opacity: 1;
    }
  `,
  toolbarButton: css`
    cursor: pointer;

    display: inline-flex;
    gap: 4px;
    align-items: center;

    height: 24px;
    padding-inline: 8px;
    border: 0;
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};

    background: transparent;

    &:hover,
    &[aria-expanded='true'] {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  view: css`
    padding: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    background: ${cssVar.colorBgContainer};
  `,
}));
