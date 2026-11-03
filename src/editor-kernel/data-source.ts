/* eslint-disable unused-imports/no-unused-vars */
import type { LexicalEditor } from 'lexical';

export interface IWriteOptions {
  /**
   * Normalize the serialized output where the data source supports it (markdown: a remark
   * round-trip). Pass `false` to get the writers' output verbatim.
   * @default true
   */
  format?: boolean;
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
