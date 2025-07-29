import 'lexical/LexicalEditor';
import { LexicalEditor, CreateEditorArgs } from 'lexical';

declare module "*.png" {
  const content: any;
  export default content;
}

declare module "*.svg" {
  const content: any;
  export default content;
}

declare module 'lexical' {

  export interface IConfig {
    decorators?: {
      [key: string]: (ndoe: DecoratorNode<any>, editor: LexicalEditor) => any;
    }
  }

  export declare function createEditor(editorConfig?: CreateEditorArgs & IConfig): LexicalEditor;
}
  