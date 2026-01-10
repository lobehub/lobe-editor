/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable unused-imports/no-unused-vars */
import { LexicalEditor } from 'lexical';

export interface IWriteOptions {
  // get selection data
  selection?: boolean;
}

export default class DataSource {
  constructor(protected dataType: string) {}

  public get type() {
    return this.dataType;
  }

  read(editor: LexicalEditor, data: any, options?: Record<string, unknown>) {}

  write(editor: LexicalEditor, options?: IWriteOptions): any {
    return null;
  }
}
