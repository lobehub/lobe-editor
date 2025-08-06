import { InsertTableCommandPayloadHeaders } from "@lexical/table";
import { createCommand } from "lexical";

export const INSERT_TABLE_COMMAND = createCommand<{ columns: string; includeHeaders?: InsertTableCommandPayloadHeaders; rows: string; }>();
