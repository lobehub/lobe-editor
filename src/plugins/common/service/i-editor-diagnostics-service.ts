import { $isTableSelection } from '@lexical/table';
import type { BaseSelection, EditorState, LexicalCommand, LexicalEditor, PointType } from 'lexical';
import {
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
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

import { EDITOR_THEME_KEY, genServiceId, getKernelFromEditor, noop } from '@/editor-kernel';
import type { IServiceID } from '@/types';

const MAX_DIAGNOSTIC_ENTRIES = 256;
const MAX_TAG_LENGTH = 64;
const MAX_NODE_TYPE_LENGTH = 64;
const MAX_SELECTION_NODES = 32;

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

export interface EditorDiagnosticsPoint {
  readonly nodeType: string;
  readonly offset: number;
  readonly runtimeKey: string;
  readonly type: 'text' | 'element';
}

export interface EditorDiagnosticsSelection {
  readonly anchor?: EditorDiagnosticsPoint;
  readonly focus?: EditorDiagnosticsPoint;
  readonly nodeTypes: readonly string[];
  readonly runtimeKeys: readonly string[];
  readonly type: EditorDiagnosticsSelectionType;
}

interface EditorDiagnosticsEntryMetadata {
  readonly editorId: string;
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

export type EditorDiagnosticsEntry =
  EditorDiagnosticsNativeEntry | EditorDiagnosticsCommandEntry | EditorDiagnosticsUpdateEntry;

export interface IEditorDiagnosticsService {
  clear(): void;
  getEntries(): readonly EditorDiagnosticsEntry[];
  setEnabled(enabled: boolean): void;
}

export const IEditorDiagnosticsService: IServiceID<IEditorDiagnosticsService> = genServiceId(
  'EditorDiagnosticsService',
);

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

const SAFE_KEY_NAMES = new Set<EditorDiagnosticsNativeEntry['keyName']>([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'Backspace',
  'Delete',
  'End',
  'Enter',
  'Escape',
  'Home',
  'PageDown',
  'PageUp',
  'Tab',
]);

const isPrintableKey = (key: string): boolean => {
  if (!key || SAFE_KEY_NAMES.has(key as EditorDiagnosticsNativeEntry['keyName'])) {
    return false;
  }

  // KeyboardEvent.key is the character itself for normal text input. Keep
  // only its class, including astral characters, so secrets never enter the
  // diagnostic buffer.
  return Array.from(key).length === 1 && !/[\p{Cc}\p{Cf}]/u.test(key);
};

const getKeyMetadata = (
  event: KeyboardEvent,
): Pick<EditorDiagnosticsNativeEntry, 'keyCategory' | 'keyName'> => {
  const key = event.key;
  if (isPrintableKey(key)) return { keyCategory: 'printable' };

  if (SAFE_KEY_NAMES.has(key as EditorDiagnosticsNativeEntry['keyName'])) {
    return {
      keyCategory: 'named',
      keyName: key as EditorDiagnosticsNativeEntry['keyName'],
    };
  }

  return { keyCategory: 'other' };
};

const getShortcut = (event: KeyboardEvent): EditorDiagnosticsShortcut | undefined => {
  if (!event.metaKey && !event.ctrlKey) return undefined;
  switch ((typeof event.key === 'string' ? event.key : '').toLowerCase()) {
    case 'a': {
      return 'selectall';
    }
    case 'c': {
      return 'copy';
    }
    case 'v': {
      return 'paste';
    }
    case 'x': {
      return 'cut';
    }
    case 'y': {
      return 'redo';
    }
    case 'z': {
      return 'undo';
    }
    default: {
      return undefined;
    }
  }
};

const getModifiers = (event: KeyboardEvent): readonly ('alt' | 'ctrl' | 'meta' | 'shift')[] => {
  const modifiers: Array<'alt' | 'ctrl' | 'meta' | 'shift'> = [];
  if (event.altKey) modifiers.push('alt');
  if (event.ctrlKey) modifiers.push('ctrl');
  if (event.metaKey) modifiers.push('meta');
  if (event.shiftKey) modifiers.push('shift');
  return modifiers;
};

const sanitizeNodeType = (value: string): string => {
  const normalized = value.replaceAll(/[\p{Cc}\p{Cf}]/gu, '').slice(0, MAX_NODE_TYPE_LENGTH);
  return normalized || 'unknown';
};

const sanitizeTag = (value: string): string =>
  value.replaceAll(/[\p{Cc}\p{Cf}]/gu, '').slice(0, MAX_TAG_LENGTH);

const getEditorId = (editor: LexicalEditor): string => {
  const kernel = getKernelFromEditor(editor);
  const editorId = kernel?.getTheme()?.[EDITOR_THEME_KEY];
  if (typeof editorId === 'string' && editorId.length > 0) return editorId;

  const internalEditor = editor as LexicalEditor & { _key?: string };
  return typeof internalEditor._key === 'string' && internalEditor._key.length > 0
    ? internalEditor._key
    : 'unknown-editor';
};

const getRootElement = (editor: LexicalEditor): HTMLElement | null => {
  const kernel = getKernelFromEditor(editor);
  if (kernel) return kernel.getRootElement();
  try {
    return editor.getRootElement();
  } catch {
    return null;
  }
};

const getPointSnapshot = (point: PointType): EditorDiagnosticsPoint => {
  const node = point.getNode();
  return {
    nodeType: sanitizeNodeType(node.getType()),
    offset: point.offset,
    runtimeKey: point.key,
    type: point.type,
  };
};

const createSelectionSnapshot = (selection: BaseSelection | null): EditorDiagnosticsSelection => {
  if (!selection) {
    return { nodeTypes: [], runtimeKeys: [], type: 'none' };
  }

  const nodeTypes: string[] = [];
  const runtimeKeys: string[] = [];
  for (const node of selection.getNodes()) {
    if (nodeTypes.length >= MAX_SELECTION_NODES && runtimeKeys.length >= MAX_SELECTION_NODES) {
      break;
    }
    const nodeType = sanitizeNodeType(node.getType());
    if (!nodeTypes.includes(nodeType) && nodeTypes.length < MAX_SELECTION_NODES) {
      nodeTypes.push(nodeType);
    }
    const runtimeKey = node.getKey();
    if (!runtimeKeys.includes(runtimeKey) && runtimeKeys.length < MAX_SELECTION_NODES) {
      runtimeKeys.push(runtimeKey);
    }
  }

  if ($isRangeSelection(selection)) {
    return {
      anchor: getPointSnapshot(selection.anchor),
      focus: getPointSnapshot(selection.focus),
      nodeTypes,
      runtimeKeys,
      type: 'range',
    };
  }

  if ($isNodeSelection(selection)) {
    return { nodeTypes, runtimeKeys, type: 'node' };
  }

  if ($isTableSelection(selection)) {
    return { nodeTypes, runtimeKeys, type: 'table' };
  }

  return { nodeTypes, runtimeKeys, type: 'unknown' };
};

const readSelection = (editorState: EditorState): EditorDiagnosticsSelection =>
  editorState.read(() => createSelectionSnapshot($getSelection()));

const cloneSelection = (selection: EditorDiagnosticsSelection): EditorDiagnosticsSelection => ({
  ...(selection.anchor ? { anchor: { ...selection.anchor } } : {}),
  ...(selection.focus ? { focus: { ...selection.focus } } : {}),
  nodeTypes: [...selection.nodeTypes],
  runtimeKeys: [...selection.runtimeKeys],
  type: selection.type,
});

const cloneEntry = (entry: EditorDiagnosticsEntry): EditorDiagnosticsEntry => {
  if (entry.kind === 'native') {
    return {
      ...entry,
      ...(entry.modifiers ? { modifiers: [...entry.modifiers] } : {}),
      selection: cloneSelection(entry.selection),
    };
  }

  if (entry.kind === 'command') {
    return { ...entry, selection: cloneSelection(entry.selection) };
  }

  return {
    ...entry,
    afterSelection: cloneSelection(entry.afterSelection),
    beforeSelection: cloneSelection(entry.beforeSelection),
    tags: [...entry.tags],
  };
};

const isElement = (target: EventTarget | null): target is HTMLElement =>
  typeof HTMLElement !== 'undefined' && target instanceof HTMLElement;

const hasEditableAncestor = (target: HTMLElement, root: HTMLElement): boolean => {
  let current: HTMLElement | null = target;
  while (current) {
    const contentEditable = current.getAttribute('contenteditable');
    if (contentEditable !== null) return contentEditable !== 'false';
    if (current === root) break;
    current = current.parentElement;
  }
  return false;
};

const getTargetInfo = (
  target: EventTarget | null,
  root: HTMLElement,
): { insideRoot: boolean; target: EditorDiagnosticsTarget } => {
  if (!isElement(target)) return { insideRoot: false, target: 'outside' };
  const insideRoot = target === root || root.contains(target);
  if (target.closest('button,[role="button"]')) return { insideRoot, target: 'button' };
  if (target.closest('input,textarea')) return { insideRoot, target: 'input' };
  if (hasEditableAncestor(target, root)) return { insideRoot, target: 'editable' };
  return { insideRoot, target: 'outside' };
};

/**
 * A deliberately small, opt-in editor trace. Command observers are installed
 * at bind time so a later critical handler cannot hide an observed command;
 * DOM and update listeners are attached only while enabled.
 */
export class EditorDiagnosticsService implements IEditorDiagnosticsService {
  private editor: LexicalEditor | null = null;

  private editorId = 'unknown-editor';

  private enabled = false;

  private sequence = 0;

  private operationSequence = 0;

  private entries: EditorDiagnosticsEntry[] = [];

  private root: HTMLElement | null = null;

  private enabledCleanup: (() => void) | null = null;

  private unregisterEditor: (() => void) | null = null;

  private bindingToken: object | null = null;

  private activeOperation: {
    expiryTimer: ReturnType<typeof setTimeout>;
    id: string;
    token: object;
  } | null = null;

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (enabled) {
      this.installEnabledListeners();
    } else {
      this.disposeEnabledListeners();
    }
  }

  getEntries(): readonly EditorDiagnosticsEntry[] {
    return this.entries.map(cloneEntry);
  }

  clear(): void {
    this.entries = [];
  }

  bindEditor(editor: LexicalEditor): () => void {
    this.disposeEditor();
    const bindingToken = {};
    this.bindingToken = bindingToken;
    this.editor = editor;
    this.editorId = getEditorId(editor);

    const commandUnregisters = COMMAND_REGISTRATIONS.map(([command, name]) =>
      editor.registerCommand(
        command,
        () => {
          if (!this.enabled || this.bindingToken !== bindingToken) return false;
          this.recordCommand(name);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );

    const kernel = getKernelFromEditor(editor);
    let unregisterRootListener = noop;
    if (kernel) {
      unregisterRootListener = kernel.registerRootListener((rootElement) => {
        if (this.bindingToken !== bindingToken) return;
        this.disposeEnabledListeners();
        if (this.enabled) this.installEnabledListeners(rootElement);
      });
    } else {
      try {
        unregisterRootListener = editor.registerRootListener((rootElement) => {
          if (this.bindingToken !== bindingToken) return;
          this.disposeEnabledListeners();
          if (this.enabled) this.installEnabledListeners(rootElement);
        });
      } catch {
        // Some headless Lexical versions reject root listener registration.
        // The command and update portions remain useful without a DOM root.
        unregisterRootListener = noop;
      }
    }

    this.unregisterEditor = () => {
      commandUnregisters.forEach((unregister) => unregister());
      unregisterRootListener();
    };

    if (this.enabled) this.installEnabledListeners(getRootElement(editor));

    return () => {
      if (this.editor !== editor || this.bindingToken !== bindingToken) return;
      this.disposeEditor();
    };
  }

  private recordCommand(command: EditorDiagnosticsCommand): void {
    const editor = this.editor;
    if (!editor) return;
    const operation = this.getOrCreateOperation();
    // Command listeners run inside Lexical's active update. Reading directly
    // here observes the selection that led to the command.
    const selection = createSelectionSnapshot($getSelection());
    this.record({
      command,
      kind: 'command',
      selection,
      ...this.metadata(operation.id),
    });
  }

  private installEnabledListeners(
    rootElement = this.editor ? getRootElement(this.editor) : null,
  ): void {
    if (!this.enabled || !this.editor || this.enabledCleanup) return;

    const editor = this.editor;
    const bindingToken = this.bindingToken;
    const root = rootElement ?? null;
    this.root = root;
    const rootListeners: Array<[EditorDiagnosticsNativeEvent, (event: Event) => void]> = [
      ['keydown', (event) => this.recordNative(event)],
      ['focusin', (event) => this.recordNative(event)],
      ['focusout', (event) => this.recordNative(event)],
      ['copy', (event) => this.recordNative(event)],
      ['cut', (event) => this.recordNative(event)],
      ['paste', (event) => this.recordNative(event)],
    ];
    rootListeners.forEach(([type, listener]) => root?.addEventListener(type, listener, true));

    const unregisterUpdate = editor.registerUpdateListener(
      ({ editorState, dirtyElements, dirtyLeaves, prevEditorState, tags }) => {
        if (!this.enabled || this.bindingToken !== bindingToken) return;
        const operation = this.getOrCreateOperation();
        this.record({
          afterSelection: readSelection(editorState),
          beforeSelection: readSelection(prevEditorState),
          dirtyElements: dirtyElements.size,
          dirtyLeaves: dirtyLeaves.size,
          kind: 'update',
          tags: Array.from(tags, sanitizeTag).filter(Boolean),
          ...this.metadata(operation.id),
        });
      },
    );

    this.enabledCleanup = () => {
      rootListeners.forEach(([type, listener]) => root?.removeEventListener(type, listener, true));
      unregisterUpdate();
      this.root = null;
    };
  }

  private recordNative(event: Event): void {
    if (!this.enabled || !this.editor || !this.root) return;
    const operation = this.getOrCreateOperation();
    const keyboardMetadata = event.type === 'keydown' ? getKeyMetadata(event as KeyboardEvent) : {};
    const modifiers = event.type === 'keydown' ? getModifiers(event as KeyboardEvent) : undefined;
    const shortcut = event.type === 'keydown' ? getShortcut(event as KeyboardEvent) : undefined;
    const targetInfo = getTargetInfo(event.target, this.root);
    const relatedTargetInfo =
      event.type === 'focusout'
        ? getTargetInfo((event as FocusEvent).relatedTarget, this.root)
        : undefined;
    const selection = this.editor
      .getEditorState()
      .read(() => createSelectionSnapshot($getSelection()));
    this.record({
      event: event.type as EditorDiagnosticsNativeEvent,
      kind: 'native',
      ...(modifiers && modifiers.length > 0 ? { modifiers } : {}),
      ...keyboardMetadata,
      ...(shortcut ? { shortcut } : {}),
      ...(relatedTargetInfo
        ? {
            relatedTarget: relatedTargetInfo.target,
            relatedTargetInsideRoot: relatedTargetInfo.insideRoot,
          }
        : {}),
      selection,
      target: targetInfo.target,
      targetInsideRoot: targetInfo.insideRoot,
      ...this.metadata(operation.id),
    });
  }

  private getOrCreateOperation(): {
    expiryTimer: ReturnType<typeof setTimeout>;
    id: string;
    token: object;
  } {
    if (this.activeOperation) return this.activeOperation;
    const token = {};
    const operation = {
      expiryTimer: setTimeout(() => {
        if (this.activeOperation?.token !== token) return;
        this.activeOperation = null;
      }, 0),
      id: `${this.editorId}:op-${++this.operationSequence}`,
      token,
    };
    this.activeOperation = operation;
    return operation;
  }

  private metadata(opId: string): EditorDiagnosticsEntryMetadata {
    return {
      editorId: this.editorId,
      opId,
      seq: ++this.sequence,
      time: Date.now(),
    };
  }

  private record(entry: EditorDiagnosticsEntry): void {
    if (this.entries.length >= MAX_DIAGNOSTIC_ENTRIES) this.entries.shift();
    this.entries.push(entry);
  }

  private disposeEnabledListeners(): void {
    this.enabledCleanup?.();
    this.enabledCleanup = null;
    this.root = null;
    if (this.activeOperation) clearTimeout(this.activeOperation.expiryTimer);
    this.activeOperation = null;
  }

  private disposeEditor(): void {
    this.disposeEnabledListeners();
    this.unregisterEditor?.();
    this.unregisterEditor = null;
    this.bindingToken = null;
    this.editor = null;
    this.editorId = 'unknown-editor';
  }
}
