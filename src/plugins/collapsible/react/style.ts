import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(
  ({ css }) => css`
    position: relative;

    margin-block: 12px;
    margin-inline: 0;
    padding-block: 14px;
    padding-inline: 42px 16px;
    border: 1px solid rgb(51 103 153 / 72%);
    border-radius: 8px;

    &[data-collapsible-collapsed='true'] {
      padding-block: 10px;
    }

    [data-collapsible-toggle='true'] {
      cursor: pointer;

      position: absolute;
      inset-block-start: 20px;
      inset-inline-start: 16px;

      width: 14px;
      height: 14px;
      padding: 0;
      border: 0;

      color: currentcolor;

      background: transparent;
    }

    &[data-collapsible-collapsed='true'] > [data-collapsible-toggle='true'] {
      inset-block-start: 15px;
    }

    [data-collapsible-toggle='true']::before {
      content: '';

      display: block;

      width: 0;
      height: 0;
      margin-block: 3px 0;
      margin-inline: 2px 0;
      border-style: solid;
    }

    &[data-collapsible-collapsed='false'] > [data-collapsible-toggle='true']::before {
      border-color: currentcolor transparent transparent;
      border-width: 7px 5px 0;
    }

    &[data-collapsible-collapsed='true'] > [data-collapsible-toggle='true']::before {
      border-color: transparent transparent transparent currentcolor;
      border-width: 5px 0 5px 7px;
    }

    [data-collapsible-content='true'] > *:first-child {
      margin-block-start: 0;
    }

    [data-collapsible-content='true'] > *:last-child {
      margin-block-end: 0;
    }

    &[data-collapsible-collapsed='true'] > [data-collapsible-content='true'] > *:first-child {
      margin-block-end: 0;
    }

    &[data-collapsible-collapsed='true'] > [data-collapsible-content='true'] > *:not(:first-child) {
      display: none !important;
    }
  `,
);
