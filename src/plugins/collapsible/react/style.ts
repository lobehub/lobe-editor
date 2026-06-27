import { css } from 'antd-style';

export const styles = css`
  position: relative;
  margin: 12px 0;
  padding: 14px 16px 14px 42px;
  border: 1px solid rgba(51, 103, 153, 0.72);
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
    color: currentColor;
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
    margin: 3px 0 0 2px;
    border-style: solid;
  }

  &[data-collapsible-collapsed='false'] > [data-collapsible-toggle='true']::before {
    border-width: 7px 5px 0 5px;
    border-color: currentColor transparent transparent transparent;
  }

  &[data-collapsible-collapsed='true'] > [data-collapsible-toggle='true']::before {
    border-width: 5px 0 5px 7px;
    border-color: transparent transparent transparent currentColor;
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
`;
