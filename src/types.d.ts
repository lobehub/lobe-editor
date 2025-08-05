import { CreateEditorArgs, LexicalEditor } from 'lexical';
import 'lexical/LexicalEditor';

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
