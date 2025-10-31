import { IEditor } from '@/types';

export interface ReactAutoCompletePluginProps {
  delay?: number;
  onAutoComplete?: (
    input: string,
    afterText: string,
    selectionType: string,
    editor: IEditor,
  ) => Promise<string | null>;
}
