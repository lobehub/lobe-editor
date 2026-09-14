import type { LexicalCommand, LexicalEditor } from 'lexical';
import {
  COMMAND_PRIORITY_CRITICAL,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  COPY_COMMAND,
  CUT_COMMAND,
  DELETE_CHARACTER_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  PASTE_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';

import { createDebugLogger } from '@/utils/debug';

import type {
  EditorDiagnosticsCommand,
  EditorDiagnosticsEntry,
  IEditorDiagnosticsService,
} from './i-editor-diagnostics-service';

const logger = createDebugLogger('service', 'editor-diagnostics');

type CommandRegistration = readonly [LexicalCommand<unknown>, EditorDiagnosticsCommand];

const COMMAND_REGISTRATIONS: readonly CommandRegistration[] = [
  [COPY_COMMAND, 'COPY_COMMAND'],
  [CUT_COMMAND, 'CUT_COMMAND'],
  [PASTE_COMMAND, 'PASTE_COMMAND'],
  [CONTROLLED_TEXT_INSERTION_COMMAND, 'CONTROLLED_TEXT_INSERTION_COMMAND'],
  [DELETE_CHARACTER_COMMAND, 'DELETE_CHARACTER_COMMAND'],
  [KEY_ARROW_LEFT_COMMAND, 'KEY_ARROW_LEFT_COMMAND'],
  [KEY_ARROW_RIGHT_COMMAND, 'KEY_ARROW_RIGHT_COMMAND'],
  [KEY_ARROW_UP_COMMAND, 'KEY_ARROW_UP_COMMAND'],
  [KEY_ARROW_DOWN_COMMAND, 'KEY_ARROW_DOWN_COMMAND'],
  [UNDO_COMMAND, 'UNDO_COMMAND'],
  [REDO_COMMAND, 'REDO_COMMAND'],
];

interface DiagnosticsCapture {
  bindEditor(editor: LexicalEditor): () => void;
  clear(): void;
  getEntries(): readonly EditorDiagnosticsEntry[];
  recordCommand(command: EditorDiagnosticsCommand): void;
  setEnabled(enabled: boolean): Promise<void> | void;
}

/**
 * The default CommonPlugin service. The command bridge is deliberately small
 * and binds early so critical command ordering remains observable; DOM,
 * selection, and update collection are loaded only after opt-in.
 */
export class EditorDiagnosticsService implements IEditorDiagnosticsService {
  private capture: DiagnosticsCapture | null = null;

  private captureBindingCleanup: (() => void) | null = null;

  private captureEnabled = false;

  private editor: LexicalEditor | null = null;

  private enabled = false;

  private loadPromise: Promise<DiagnosticsCapture | null> | null = null;

  private bindingToken: object | null = null;

  private unregisterEditor: (() => void) | null = null;

  setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;

    if (!enabled) {
      this.captureEnabled = false;
      return this.capture
        ? this.setCaptureEnabled(this.capture, false).then(() => undefined)
        : Promise.resolve();
    }

    return this.ensureCapture().then((capture) => this.activateCapture(capture));
  }

  getEntries(): readonly EditorDiagnosticsEntry[] {
    return this.capture?.getEntries() ?? [];
  }

  clear(): void {
    this.capture?.clear();
  }

  bindEditor(editor: LexicalEditor): () => void {
    this.disposeEditor();

    const bindingToken = {};
    this.bindingToken = bindingToken;
    this.editor = editor;

    const commandUnregisters = COMMAND_REGISTRATIONS.map(([command, name]) =>
      editor.registerCommand(
        command,
        () => {
          this.handleCommand(name, bindingToken);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );

    this.unregisterEditor = () => {
      commandUnregisters.forEach((unregister) => unregister());
    };

    if (this.capture) {
      this.attachCapture(this.capture);
      if (this.enabled) void this.activateCapture(this.capture);
    }

    return () => {
      if (this.editor !== editor || this.bindingToken !== bindingToken) return;
      this.disposeEditor();
    };
  }

  /**
   * Release the current editor binding. The service can be rebound while its
   * already-loaded capture module is retained for a later opt-in.
   */
  destroy(): void {
    this.enabled = false;
    this.disposeEditor();
  }

  private ensureCapture(): Promise<DiagnosticsCapture | null> {
    if (this.capture) return Promise.resolve(this.capture);
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = import('./editor-diagnostics-capture')
      .then(({ EditorDiagnosticsCapture }) => {
        const capture = new EditorDiagnosticsCapture();
        this.capture = capture;
        return capture;
      })
      .catch((error: unknown) => {
        this.loadPromise = null;
        logger.warn('Editor diagnostics could not be loaded', error);
        return null;
      });

    return this.loadPromise;
  }

  private async activateCapture(capture: DiagnosticsCapture | null): Promise<void> {
    if (!this.enabled || !this.editor || !this.bindingToken) return;
    if (!capture) return;
    if (!this.captureBindingCleanup) this.attachCapture(capture);

    if (!(await this.setCaptureEnabled(capture, true))) return;
    if (!this.enabled || this.capture !== capture || !this.captureBindingCleanup) return;

    this.captureEnabled = true;
  }

  private async setCaptureEnabled(capture: DiagnosticsCapture, enabled: boolean): Promise<boolean> {
    try {
      await capture.setEnabled(enabled);
      return true;
    } catch (error: unknown) {
      this.captureEnabled = false;
      logger.warn('Editor diagnostics could not be ' + (enabled ? 'enabled' : 'disabled'), error);
      return false;
    }
  }

  private attachCapture(capture: DiagnosticsCapture): void {
    const editor = this.editor;
    if (!editor || this.capture !== capture) return;

    this.disposeCaptureBinding();
    this.captureBindingCleanup = capture.bindEditor(editor);
  }

  private disposeCaptureBinding(): void {
    this.captureEnabled = false;
    const capture = this.capture;
    if (capture) void this.setCaptureEnabled(capture, false);
    this.captureBindingCleanup?.();
    this.captureBindingCleanup = null;
  }

  private handleCommand(command: EditorDiagnosticsCommand, bindingToken: object): void {
    if (!this.enabled || this.bindingToken !== bindingToken) return;

    if (this.capture && this.captureEnabled) {
      this.capture.recordCommand(command);
    }
  }

  private disposeEditor(): void {
    this.disposeCaptureBinding();
    this.unregisterEditor?.();
    this.unregisterEditor = null;
    this.bindingToken = null;
    this.editor = null;
  }
}
