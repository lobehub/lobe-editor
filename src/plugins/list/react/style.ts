import { createStyles } from 'antd-style';

export const useStyles = createStyles(
  ({ css }) => css`
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

      > .editor_listItem:not(:has(ul)) {
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

    .editor_listItemNested {
      list-style-type: none;
    }
  `,
);
