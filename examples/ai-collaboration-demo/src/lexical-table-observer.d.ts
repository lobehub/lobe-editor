declare module '@lexical/table/LexicalTableObserver' {
  import type { TableDOMCell } from '@lexical/table';

  export interface TableDOMTable {
    columns: number;
    domRows: Array<Array<TableDOMCell | undefined> | undefined>;
    rows: number;
  }
}
