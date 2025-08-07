import type { LobeCustomStylish, LobeCustomToken } from '@lobehub/ui';
import 'antd-style';
import 'lexical/LexicalEditor';

declare module 'antd-style' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface CustomToken extends LobeCustomToken {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface CustomStylish extends LobeCustomStylish {}
}

declare module '*.png' {
  const content: any;
  export default content;
}

declare module '*.svg' {
  const content: any;
  export default content;
}
