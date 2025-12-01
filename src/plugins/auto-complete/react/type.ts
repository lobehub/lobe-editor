import { IEditor } from '@/types';

export interface ReactAutoCompletePluginProps {
  delay?: number;
  onAutoComplete?: (opt: {
    abortSignal: AbortSignal;
    afterText: string;
    editor: IEditor;
    input: string;
    selectionType: string;
  }) => Promise<string | null>;
}
