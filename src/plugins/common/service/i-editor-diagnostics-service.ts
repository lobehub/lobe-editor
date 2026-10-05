import { genServiceId } from '@/editor-kernel';
import type { IServiceID } from '@/types';

export type EditorDiagnosticsNativeEvent =
  'keydown' | 'focusin' | 'focusout' | 'copy' | 'cut' | 'paste';

export type EditorDiagnosticsTarget = 'input' | 'button' | 'editable' | 'outside';

export type EditorDiagnosticsShortcut = 'copy' | 'cut' | 'paste' | 'redo' | 'selectall' | 'undo';

export type EditorDiagnosticsCommand =
  | 'COPY_COMMAND'
  | 'CUT_COMMAND'
  | 'PASTE_COMMAND'
  | 'CONTROLLED_TEXT_INSERTION_COMMAND'
  | 'DELETE_CHARACTER_COMMAND'
  | 'KEY_ARROW_LEFT_COMMAND'
  | 'KEY_ARROW_RIGHT_COMMAND'
  | 'KEY_ARROW_UP_COMMAND'
  | 'KEY_ARROW_DOWN_COMMAND'
  | 'UNDO_COMMAND'
  | 'REDO_COMMAND';

export type EditorDiagnosticsSelectionType = 'none' | 'range' | 'node' | 'table' | 'unknown';

/**
 * An editor-local Lexical key used only to correlate entries in one in-memory
 * diagnostics session. It is not a protocol nodeId and must not become a
 * document/protocol identity or a cross-session correlation key. Strip it
 * before sending diagnostics to remote telemetry.
 */
export type EditorDiagnosticsRuntimeKey = string;

export interface EditorDiagnosticsPoint {
  readonly nodeType: string;
  readonly offset: number;
  /** Local session key; never a protocol nodeId, durable identity, or upload field. */
  readonly runtimeKey: EditorDiagnosticsRuntimeKey;
  readonly type: 'text' | 'element';
}

export interface EditorDiagnosticsSelection {
  readonly anchor?: EditorDiagnosticsPoint;
  readonly focus?: EditorDiagnosticsPoint;
  readonly nodeTypes: readonly string[];
  /** Local session keys; never protocol nodeIds, durable identities, or upload fields. */
  readonly runtimeKeys: readonly EditorDiagnosticsRuntimeKey[];
  readonly type: EditorDiagnosticsSelectionType;
}

interface EditorDiagnosticsEntryMetadata {
  /** Local editor-session metadata for in-memory diagnostics correlation only. */
  readonly editorId: string;
  /** Local operation label for in-memory diagnostics correlation only. */
  readonly opId: string;
  readonly seq: number;
  readonly time: number;
}

export interface EditorDiagnosticsNativeEntry extends EditorDiagnosticsEntryMetadata {
  readonly event: EditorDiagnosticsNativeEvent;
  readonly keyCategory?: 'named' | 'other' | 'printable';
  readonly keyName?:
    | 'ArrowDown'
    | 'ArrowLeft'
    | 'ArrowRight'
    | 'ArrowUp'
    | 'Backspace'
    | 'Delete'
    | 'End'
    | 'Enter'
    | 'Escape'
    | 'Home'
    | 'PageDown'
    | 'PageUp'
    | 'Tab';
  readonly kind: 'native';
  readonly modifiers?: readonly ('alt' | 'ctrl' | 'meta' | 'shift')[];
  readonly relatedTarget?: EditorDiagnosticsTarget;
  readonly relatedTargetInsideRoot?: boolean;
  readonly selection: EditorDiagnosticsSelection;
  readonly shortcut?: EditorDiagnosticsShortcut;
  readonly target: EditorDiagnosticsTarget;
  readonly targetInsideRoot: boolean;
}

export interface EditorDiagnosticsCommandEntry extends EditorDiagnosticsEntryMetadata {
  readonly command: EditorDiagnosticsCommand;
  readonly kind: 'command';
  readonly selection: EditorDiagnosticsSelection;
}

export interface EditorDiagnosticsUpdateEntry extends EditorDiagnosticsEntryMetadata {
  readonly afterSelection: EditorDiagnosticsSelection;
  readonly beforeSelection: EditorDiagnosticsSelection;
  readonly dirtyElements: number;
  readonly dirtyLeaves: number;
  readonly kind: 'update';
  readonly tags: readonly string[];
}

/**
 * In-memory debug log entry. It may be saved or exported for local debugging;
 * strip runtime keys before remote telemetry or protocol upload.
 */
export type EditorDiagnosticsEntry =
  EditorDiagnosticsNativeEntry | EditorDiagnosticsCommandEntry | EditorDiagnosticsUpdateEntry;

export interface IEditorDiagnosticsService {
  clear(): void;
  getEntries(): readonly EditorDiagnosticsEntry[];
  /**
   * Toggle the in-memory diagnostics trace. Await the returned promise before
   * relying on capture listeners being ready.
   */
  setEnabled(enabled: boolean): Promise<void>;
}

export const IEditorDiagnosticsService: IServiceID<IEditorDiagnosticsService> = genServiceId(
  'EditorDiagnosticsService',
);
