import type { ICodeMirrorInstance } from '@/codemirror';
import type {
  CollaborationEmbeddedText,
  CollaborationEmbeddedTextChange,
} from '@/common/collaboration';

import { computeEmbeddedTextChange, type EmbeddedTextChange } from './embedded-text-change';

interface EmbeddedTextAdapterOptions {
  canWrite: () => boolean;
  onLocalChange?: (value: string) => void;
}

type TextChange = EmbeddedTextChange;

/**
 * Bidirectional source adapter for the existing CodeMirror 6 wrapper.
 *
 * `@lobehub/codemirror` exposes the underlying `EditorView` but not an
 * extension injection point, so the official `loro-codemirror` extension
 * cannot be mounted after `fromTextArea`. This adapter uses that same
 * CodeMirror transaction boundary (`view.dispatch({ changes })`) and maps a
 * single local text change to the binding-owned LoroText transaction.
 */
export class EmbeddedTextAdapter {
  private disposed = false;
  private mirror: string;
  private ignoredRemoteValue: string | null = null;
  private readonly unsubscribeSource: () => void;
  private readonly restoreDispatch: (() => void) | null;
  private dispatchingRemote = false;
  private dispatchingTransaction = false;
  private started = false;

  constructor(
    private readonly instance: ICodeMirrorInstance,
    private readonly source: CollaborationEmbeddedText,
    private readonly options: EmbeddedTextAdapterOptions,
  ) {
    this.mirror = instance.getValue();
    this.unsubscribeSource = source.onChange(() => this.syncFromSource());
    instance.on('change', this.handleEditorChange);
    this.restoreDispatch = this.patchViewDispatch();
  }

  start(): void {
    if (this.disposed || this.started) return;
    this.started = true;
    this.syncFromSource();
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribeSource();
    this.restoreDispatch?.();
  }

  handleKeyDown(event: KeyboardEvent): boolean {
    if (this.disposed || (!event.ctrlKey && !event.metaKey) || event.altKey) return false;
    const key = event.key.toLowerCase();
    const isUndo = key === 'z' && !event.shiftKey;
    const isRedo = key === 'y' || (key === 'z' && event.shiftKey);
    if (!isUndo && !isRedo) return false;
    // Always consume the key once the adapter recognizes it. A false result
    // means the binding history is empty; it must not fall through to
    // CodeMirror's private history stack and undo a text change that Loro
    // does not know about. Readonly/remote-lock windows are also binding
    // state, so they consume the command without mutating history.
    event.preventDefault();
    event.stopPropagation();
    if (!this.options.canWrite()) return true;
    if (isUndo) this.source.undo?.();
    else this.source.redo?.();
    return true;
  }

  private readonly handleEditorChange = (): void => {
    if (this.disposed || this.dispatchingTransaction) return;
    const next = this.instance.getValue();
    if (next === this.mirror) return;

    if (this.ignoredRemoteValue === next) {
      this.ignoredRemoteValue = null;
      this.mirror = next;
      return;
    }

    if (!this.options.canWrite()) {
      this.dispatchText(this.mirror);
      return;
    }

    const change = computeEmbeddedTextChange(this.mirror, next);
    if (!change) return;
    const previous = this.mirror;
    this.mirror = next;
    try {
      this.source.applyLocalChange(change.from, change.to, change.insert);
      this.options.onLocalChange?.(next);
    } catch {
      this.mirror = previous;
      this.dispatchText(previous);
    }
  };

  private patchViewDispatch(): (() => void) | null {
    const view = this.instance.view as unknown as {
      dispatch: (transaction: { changes?: unknown; [key: string]: unknown }) => void;
    };
    const original = view.dispatch;
    if (typeof original !== 'function') return null;
    const bound = original.bind(this.instance.view) as (...args: unknown[]) => void;
    const wrapped = (
      ...transactions: Array<{ changes?: unknown; [key: string]: unknown }>
    ): void => {
      const args =
        transactions.length === 1 && Array.isArray(transactions[0])
          ? (transactions[0] as unknown as Array<{ changes?: unknown; [key: string]: unknown }>)
          : transactions;
      const remote = this.dispatchingRemote;
      const writable = this.options.canWrite();
      const dispatchArgs = remote || writable ? args : filterReadonlyTransactions(args);

      // Gate document mutations before the underlying EditorView sees them.
      // `handleEditorChange` is suppressed during this dispatch, so checking
      // canWrite only after `bound(...args)` would leave a local edit in the
      // CodeMirror document with no corresponding Loro transaction.
      if (!remote && !writable && dispatchArgs.length === 0) return;
      this.dispatchingTransaction = true;
      try {
        bound(...dispatchArgs);
      } finally {
        this.dispatchingTransaction = false;
      }
      if (remote || this.disposed || !writable) return;
      const changeSets = dispatchArgs.map((transaction) => readChangeSet(transaction.changes));
      if (changeSets.every((changes) => changes.length === 0)) return;
      this.mirror = this.instance.getValue();
      try {
        for (const changes of changeSets) {
          if (changes.length === 0) continue;
          if (this.source.applyLocalChanges) this.source.applyLocalChanges(changes);
          else {
            changes.forEach((change) =>
              this.source.applyLocalChange(change.from, change.to, change.insert),
            );
          }
        }
        this.options.onLocalChange?.(this.mirror);
      } catch {
        this.syncFromSource();
      }
    };
    try {
      view.dispatch = wrapped as typeof view.dispatch;
      return () => {
        if (view.dispatch === wrapped) view.dispatch = original;
      };
    } catch {
      return null;
    }
  }

  private syncFromSource(): void {
    if (this.disposed || !this.started) return;
    const next = this.source.read();
    if (next === this.mirror) return;
    this.mirror = next;
    this.ignoredRemoteValue = next;
    this.dispatchText(next);
  }

  private dispatchText(next: string): void {
    const change = computeEmbeddedTextChange(this.instance.getValue(), next);
    if (!change) return;
    this.ignoredRemoteValue = next;
    const view = this.instance.view as unknown as {
      dispatch: (transaction: { changes: TextChange[] }) => void;
    };
    this.dispatchingRemote = true;
    try {
      view.dispatch({ changes: [change] });
    } finally {
      this.dispatchingRemote = false;
    }
  }
}

const readChangeSet = (value: unknown): CollaborationEmbeddedTextChange[] => {
  if (Array.isArray(value)) {
    return value.map(toEmbeddedTextChange).filter(isTextChange);
  }
  if (!value || typeof value !== 'object') return [];
  const spec = toEmbeddedTextChange(value);
  if (spec) return [spec];
  const candidate = value as {
    iterChanges?: (
      callback: (from: number, to: number, _fromB: number, _toB: number, insert: unknown) => void,
    ) => void;
  };
  if (typeof candidate.iterChanges !== 'function') return [];
  const changes: CollaborationEmbeddedTextChange[] = [];
  candidate.iterChanges((from, to, _fromB, _toB, insert) => {
    const text =
      typeof insert === 'string'
        ? insert
        : insert && typeof (insert as { toString?: unknown }).toString === 'function'
          ? String(insert)
          : '';
    if (from !== to || text.length > 0) changes.push({ from, insert: text, to });
  });
  return changes;
};

const toEmbeddedTextChange = (value: unknown): CollaborationEmbeddedTextChange | null => {
  if (!value || typeof value !== 'object') return null;
  const change = value as { from?: unknown; insert?: unknown; to?: unknown };
  if (typeof change.from !== 'number') return null;
  const insert =
    typeof change.insert === 'string'
      ? change.insert
      : change.insert && typeof (change.insert as { toString?: unknown }).toString === 'function'
        ? String(change.insert)
        : '';
  const to = typeof change.to === 'number' ? change.to : change.from;
  if (change.from === to && insert.length === 0) return null;
  return { from: change.from, insert, to };
};

const isTextChange = (
  change: CollaborationEmbeddedTextChange | null,
): change is CollaborationEmbeddedTextChange => change !== null;

const filterReadonlyTransactions = (
  transactions: readonly { changes?: unknown; [key: string]: unknown }[],
): Array<{ changes?: unknown; [key: string]: unknown }> =>
  transactions.flatMap((transaction) => {
    if (!hasDocumentChanges(transaction)) return [transaction];

    // A TransactionSpec can be cloned as a selection/effects-only spec. A
    // materialized CodeMirror Transaction is immutable and carries docChanged;
    // dropping that input is the only safe way to reject its document edit at
    // the dispatch boundary.
    if (isTransactionSpec(transaction)) return [{ ...transaction, changes: [] }];
    return [];
  });

const hasDocumentChanges = (transaction: {
  changes?: unknown;
  [key: string]: unknown;
}): boolean => {
  if (transaction.docChanged === true) return true;
  return readChangeSet(transaction.changes).length > 0;
};

const isTransactionSpec = (transaction: { changes?: unknown; [key: string]: unknown }): boolean =>
  !('docChanged' in transaction);

export { computeEmbeddedTextChange } from './embedded-text-change';
