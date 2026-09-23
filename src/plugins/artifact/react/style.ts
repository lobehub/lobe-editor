import { createStaticStyles } from 'antd-style';

export const artifactStyles = createStaticStyles(
  ({ css, cssVar }) => css`
    position: relative;

    overflow: hidden;

    width: 100%;
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);

    background: ${cssVar.colorBgContainer};

    &::after {
      pointer-events: none;
      content: '';

      position: absolute;
      z-index: 3;
      inset: 0;

      opacity: 0;
      background: color-mix(in srgb, ${cssVar.colorWarning} 16%, transparent);

      transition: opacity 120ms ${cssVar.motionEaseOut};
    }

    &.artifact-selected::after {
      opacity: 1;
    }

    &.artifact-selected {
      user-select: none;
    }

    .artifact-header {
      display: grid;
      grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr);
      align-items: center;
      border-block-end: 1px solid ${cssVar.colorBorderSecondary};
      background: ${cssVar.colorFillQuaternary};
    }

    .artifact-heading {
      display: flex;
      gap: 8px;
      align-items: center;

      min-width: 0;
      height: 38px;
      padding-inline: 12px;

      font-size: 12px;
      color: ${cssVar.colorTextSecondary};
    }

    .artifact-view-controls {
      display: flex;
      align-items: center;
      justify-content: flex-end;

      min-width: 0;
      padding: 6px 12px;
    }

    .artifact-view-mode {
      width: 100%;
      min-width: 0;
    }

    .artifact-view-mode .ant-segmented,
    .artifact-view-mode .ant-segmented-group {
      width: 100%;
    }

    .artifact-view-mode .ant-segmented-item {
      min-width: 0;
      flex: 1;
    }

    .artifact-view-mode .ant-segmented-item-label {
      overflow: hidden;

      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .artifact-view-option {
      display: inline-flex;
      overflow: hidden;
      gap: 4px;
      align-items: center;

      max-width: 100%;

      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .artifact-title {
      overflow: hidden;
      flex: 1;

      min-width: 0;
      padding: 0;
      border: 0;

      color: ${cssVar.colorText};
      text-overflow: ellipsis;

      background: transparent;
      outline: 0;
    }

    .artifact-body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      min-height: var(--lobe-artifact-preview-height, 420px);
    }

    .artifact-body.artifact-preview-only {
      display: block;
    }

    .artifact-body.artifact-preview-only .artifact-preview {
      width: 100%;
    }

    .artifact-body.artifact-code-only {
      display: block;
    }

    .artifact-body.artifact-code-only .artifact-code {
      width: 100%;
      border-inline-end: 0;
    }

    .artifact-body.artifact-code-only .artifact-preview-hidden {
      display: none;
    }

    .artifact-code,
    .artifact-preview {
      min-width: 0;
      height: var(--lobe-artifact-preview-height, 420px);
      min-height: var(--lobe-artifact-preview-height, 420px);
    }

    .artifact-code {
      position: relative;
      overflow: hidden;
      border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
      background: ${cssVar.colorBgLayout};
    }

    .artifact-code .cm-gutters,
    .artifact-code .cm-gutters * {
      user-select: none;
    }

    &.artifact-selected,
    &.artifact-selected * {
      user-select: none !important;
    }

    .artifact-code .cm-textarea {
      width: 100%;
      height: var(--lobe-artifact-preview-height, 420px);
      opacity: 0;
    }

    .artifact-code .cm-editor {
      height: var(--lobe-artifact-preview-height, 420px);
    }

    .artifact-preview {
      overflow: hidden;
      background: #fff;
    }

    .artifact-frame {
      display: block;

      width: 100%;
      height: var(--lobe-artifact-preview-height, 420px);
      min-height: var(--lobe-artifact-preview-height, 420px);
      border: 0;

      background: #fff;
    }

    &.artifact-readonly {
      /* The Lexical Decorator host is intentionally unstyled; keep the same
         block spacing on the visible readonly surface instead. */
      margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
    }

    &.artifact-readonly .artifact-preview,
    &.artifact-readonly .artifact-frame {
      width: 100%;
    }

    @media (width <= 720px) {
      .artifact-body {
        grid-template-columns: minmax(0, 1fr);
      }

      .artifact-code {
        border-block-start: 1px solid ${cssVar.colorBorderSecondary};
        border-inline-start: 0;
        border-inline-end: 0;
      }
    }
  `,
);
