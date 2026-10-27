import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  alert: css`
    --alert-color: ${cssVar.colorInfo};

    margin-block: calc(var(--lobe-markdown-margin-multiple, 1) * 0.5em);
    margin-inline: 0;
    padding-block: 8px;
    padding-inline: 16px;
    border-inline-start: 3px solid var(--alert-color);
    border-radius: 4px;

    background: color-mix(in srgb, var(--alert-color) 6%, transparent);

    &[data-alert-type='tip'] {
      --alert-color: ${cssVar.colorSuccess};
    }

    &[data-alert-type='important'] {
      --alert-color: ${cssVar.purple};
    }

    &[data-alert-type='warning'] {
      --alert-color: ${cssVar.colorWarning};
    }

    &[data-alert-type='caution'] {
      --alert-color: ${cssVar.colorError};
    }

    [data-alert-header='true'] {
      user-select: none;
      display: flex;
      align-items: center;
      min-height: 24px;
    }

    [data-alert-content='true'] > *:first-child {
      margin-block-start: 0;
    }

    [data-alert-content='true'] > *:last-child {
      margin-block-end: 0;
    }
  `,
  header: css`
    cursor: default;

    display: inline-flex;
    gap: 6px;
    align-items: center;

    margin-inline-start: -4px;
    padding-block: 2px;
    padding-inline: 4px;
    border: 0;
    border-radius: 4px;

    font-size: 0.875em;
    font-weight: 600;
    line-height: 1.5;
    color: var(--alert-color);

    background: transparent;

    &[data-editable='true'] {
      cursor: pointer;

      &:hover {
        background: color-mix(in srgb, var(--alert-color) 12%, transparent);
      }
    }
  `,
}));
