import { IEditor } from '@/types';

export interface ReactAutoCompletePluginProps {
  delay?: number;
  onAutoComplete?: (
    input: string,
    selectionType: string,
    editor: IEditor,
  ) => Promise<string | null>;
}
