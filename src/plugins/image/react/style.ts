/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  image: css`
    cursor: default;
    user-select: none;
    position: relative;
    display: inline-block;

    &.selected {
      background-color: ${token.colorPrimaryBg};
    }
  `,

  blockImage: css`
    cursor: default;
    user-select: none;

    position: relative;

    display: block;

    text-align: center;

    &.selected {
      background-color: ${token.colorPrimaryBg};
    }
  `,
}));

export const imageBroken =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCA2NDAgNDAwIj48cGF0aCBmaWxsPSIjM0IzQjNCIiBkPSJNMCAwaDY0MHY0MDBIMHoiLz48cGF0aCBzdHJva2U9IiM2MjYyNjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIxNSIgZD0iTTM3Mi41IDEzMi41aC0xMDVjLTguMjg0IDAtMTUgNi43MTYtMTUgMTV2MTA1YzAgOC4yODQgNi43MTYgMTUgMTUgMTVoMTA1YzguMjg0IDAgMTUtNi43MTYgMTUtMTV2LTEwNWMwLTguMjg0LTYuNzE2LTE1LTE1LTE1eiIvPjxwYXRoIHN0cm9rZT0iIzYyNjI2MiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjE1IiBkPSJNMjk3LjUgMTkyLjVjOC4yODQgMCAxNS02LjcxNiAxNS0xNSAwLTguMjg0LTYuNzE2LTE1LTE1LTE1LTguMjg0IDAtMTUgNi43MTYtMTUgMTUgMCA4LjI4NCA2LjcxNiAxNSAxNSAxNXpNMzg3LjUgMjIyLjUwMmwtMjMuMTQ1LTIzLjE0NWExNS4wMDEgMTUuMDAxIDAgMDAtMjEuMjEgMEwyNzUgMjY3LjUwMiIvPjwvc3ZnPg==';
