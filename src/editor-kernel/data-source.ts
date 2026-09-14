/* eslint-disable unused-imports/no-unused-vars */
import type { LexicalEditor } from 'lexical';

export interface IWriteOptions {
  // get selection data
  selection?: boolean;
  /** Include private Markdown transport metadata when explicitly requested. */
  includeNodeIds?: boolean;
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
