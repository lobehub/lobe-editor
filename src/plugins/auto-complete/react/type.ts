import { IEditor } from '@/types';

export interface ReactAutoCompletePluginProps {
  delay?: number;
  onAutoComplete?: (opt: {
    abortSignal: AbortSignal;
    afterText: string;
    editor: IEditor;
    input: string;
    selectionType: string;
    suggestionId?: string;
  }) => Promise<string | null>;
  onSuggestionAccepted?: (info: {
    acceptedText: string;
    suggestionId: string;
    visibleMs: number;
  }) => void;
  onSuggestionRejected?: (info: {
    reason: 'cursor-move' | 'typing' | 'esc' | 'blur' | 'other';
    suggestionId: string;
    visibleMs: number;
  }) => void;
}
