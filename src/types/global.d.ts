import type { LobeCustomStylish, LobeCustomToken } from '@lobehub/ui';
import 'antd-style';
import { CreateEditorArgs, LexicalEditor } from 'lexical';
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

declare module 'lexical' {
  export interface IConfig {
    decorators?: {
      // eslint-disable-next-line no-undef
      [key: string]: (ndoe: DecoratorNode<any>, editor: LexicalEditor) => any;
    };
  }

  export declare function createEditor(editorConfig?: CreateEditorArgs & IConfig): LexicalEditor;
}
