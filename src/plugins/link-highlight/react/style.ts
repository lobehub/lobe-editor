import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(({ css }) => {
  return {
    linkHighlight: css`
      cursor: unset;

      margin-block: 1em;
      margin-inline: 0;
      padding: 2px;
      border: none;
    `,
  };
});
