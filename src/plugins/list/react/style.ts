import { createStyles } from 'antd-style';

export const useStyles = createStyles(
  ({ css, token }) => css`
    .editor_listUnordered&,
    .editor_listOrdered& {
      margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
      margin-inline-start: 1em;
      padding-inline-start: 0;
      list-style-position: outside;

      > .editor_listUnordered,
      > ol {
        margin-block: 0;
      }

      > .editor_listItem {
        margin-inline-start: 1em;
      }
    }

    .editor_listOrdered& {
      list-style: auto;
    }

    .editor_listUnordered& {
      list-style-type: none;

      > .editor_listItem:not(:has(ul)):not([role='checkbox']) {
        &::before {
          content: '-';
          display: inline-block;
          margin-inline: -1em 0.5em;
          opacity: 0.5;
        }
      }
    }

    .editor_listItem {
      margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.33em);
      font-family: var(--listitem-marker-font-family);
      font-size: var(--listitem-marker-font-size);
      background-color: var(--listitem-marker-background-color);

      &::marker {
        font-family: var(--listitem-marker-font-family);
        font-size: var(--listitem-marker-font-size);
        color: var(--listitem-marker-color);
        background-color: var(--listitem-marker-background-color);
      }

      p {
        display: inline;
      }

      .editor_listUnordered,
      .editor_listOrdered {
        margin: 0;
      }
    }

    [role='checkbox'] {
      position: relative;
    }

    .editor_listItemChecked::before,
    .editor_listItemUnchecked::before {
      border: 1px solid ${token.colorInfoBorder};
      border-radius: 2px;
    }

    .editor_listItemChecked::before {
      background: ${token.colorInfoActive};
    }

    .editor_listItemChecked:not(:has(ul))::after {
      cursor: pointer;
      content: '';

      position: absolute;
      inset-block-start: 50%;
      inset-inline-start: 0.2em;
      transform: rotate(45deg) scale(1) translate(-50%, -50%);

      display: block;

      width: 0.3em;
      height: 0.6em;
      margin-inline: -1.2em 0.5em;
      border: 2px solid ${token.colorPrimary};
      border-block-start: 0;
      border-inline-start: 0;
      opacity: 0.5;
      background-size: cover;

      transition: all 0.2s cubic-bezier(0.12, 0.4, 0.29, 1.46) 0.1s;
    }

    .editor_listItemUnchecked:not(:has(ul))::before,
    .editor_listItemChecked:not(:has(ul))::before {
      cursor: pointer;
      content: '';

      position: absolute;
      inset-block-start: 50%;
      inset-inline-start: 0;
      transform: translateY(-50%);

      display: inline-block;
      display: block;

      width: 0.9em;
      height: 0.9em;
      margin-inline: -1.2em 0.5em;

      opacity: 0.5;
      background-size: cover;
    }

    .editor_listItemNested {
      list-style-type: none;
    }
  `,
);
