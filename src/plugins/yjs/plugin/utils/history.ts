import { type Binding } from '@lexical/yjs';
import {
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  HISTORY_PUSH_TAG,
  type LexicalEditor,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { type AbstractType, type Item, type Transaction, UndoManager } from 'yjs';

export type YjsHistoryOrigin = object | symbol;

/**
 * A per-editor origin used only for browser-authored edits. Yjs compares
 * origins by identity, so each connected editor gets an isolated undo stack.
 */
export const createYjsHumanOrigin = (): YjsHistoryOrigin => ({
  kind: 'lobe-yjs-human',
  token: Symbol('lobe-yjs-human'),
});

export interface RegisterYjsHistoryOptions {
  /**
   * The origin emitted by this editor's local human sync transactions. The
   * binding remains the compatibility default for callers that manually call
   * syncLexicalUpdateToYjs, while the browser plugin passes its own origin.
   */
  humanOrigin?: YjsHistoryOrigin;
}

type YjsContentType = AbstractType<unknown> & {
  nodeName?: string;
  get?: (key: string) => unknown;
  getAttribute?: (key: string) => unknown;
};

type YjsStackItem = {
  insertions: {
    clients: Map<number, Array<{ clock: number; len: number }>>;
  };
  deletions: {
    clients: Map<number, Array<{ clock: number; len: number }>>;
  };
};

const getContentType = (item: Item): YjsContentType | null => {
  const content = item.content as { type?: unknown };
  return content.type && typeof content.type === 'object' ? (content.type as YjsContentType) : null;
};

const getContentTypeName = (type: YjsContentType): string | undefined => {
  const typeName = type.get?.('__type') ?? type.getAttribute?.('__type');
  if (typeof typeName === 'string') return typeName;
  return typeof type.nodeName === 'string' ? type.nodeName : undefined;
};

const isBoundaryCursorItem = (item: Item, parentType: YjsContentType): boolean =>
  getContentTypeName(parentType) === 'hole' &&
  typeof (item.content as { str?: unknown }).str === 'string' &&
  (item.content as unknown as { str: string }).str === '\uFEFF';

const isCursorType = (type: YjsContentType): boolean => getContentTypeName(type) === 'cursor';

/**
 * Yjs UndoManager's deleteFilter is called for each local insertion Item that
 * an undo would remove. Track the shared types touched by foreign transactions
 * and inspect only the current stack item's inserted subtrees. If one local
 * structural insertion contains a later foreign change, the whole stack item
 * becomes a no-op; filtering only its parent would leave a partially deleted
 * Lexical/Yjs tree. An unrelated remote edit elsewhere therefore does not
 * block ordinary local typing.
 */
const hasForeignDescendant = (
  type: YjsContentType,
  localClientId: number,
  foreignTypes: WeakSet<object>,
  visited: Set<object>,
): boolean => {
  if (foreignTypes.has(type)) return true;
  if (visited.has(type)) return false;
  visited.add(type);

  let child = type._start;
  while (child) {
    if (!child.deleted && !isBoundaryCursorItem(child, type)) {
      const childType = getContentType(child);
      if (childType && isCursorType(childType)) {
        child = child.right;
        continue;
      }
      if (child.id.client !== localClientId) return true;
      if (childType && hasForeignDescendant(childType, localClientId, foreignTypes, visited)) {
        return true;
      }
    }
    child = child.right;
  }

  for (const child of type._map.values()) {
    if (child.deleted) continue;
    const childType = getContentType(child);
    if (childType && isCursorType(childType)) continue;
    if (child.id.client !== localClientId) return true;
    if (childType && hasForeignDescendant(childType, localClientId, foreignTypes, visited)) {
      return true;
    }
  }

  return false;
};

const createForeignChangeDeleteFilter = (
  binding: Binding,
  humanOrigin: YjsHistoryOrigin,
  undoManagerRef: { current: UndoManager | null },
) => {
  const foreignTypes = new WeakSet<object>();
  const localClientId = binding.doc.clientID;
  const onAfterTransaction = (transaction: Transaction): void => {
    if (
      transaction.origin === binding ||
      transaction.origin === humanOrigin ||
      transaction.origin === undoManagerRef.current
    ) {
      return;
    }
    transaction.changedParentTypes.forEach((_events, type) => {
      foreignTypes.add(type);
    });
  };
  binding.doc.on('afterTransaction', onAfterTransaction);

  let protectCurrentStackItem = false;
  const findInsertedItems = (client: number, clock: number, length: number): Item[] => {
    const structs = binding.doc.store.clients.get(client) ?? [];
    const rangeEnd = clock + length;
    let low = 0;
    let high = structs.length;
    // StructStore clients are clock ordered. Find the first struct intersecting
    // this DeleteSet range instead of probing every clock in a large insert.
    while (low < high) {
      const middle = (low + high) >> 1;
      const candidate = structs[middle] as Partial<Item>;
      const candidateEnd = candidate.id
        ? candidate.id.clock + (candidate.length ?? 0)
        : Number.POSITIVE_INFINITY;
      if (candidateEnd <= clock) low = middle + 1;
      else high = middle;
    }

    const items: Item[] = [];
    for (let index = low; index < structs.length; index += 1) {
      const struct = structs[index];
      const candidate = struct as Partial<Item>;
      if (!candidate.id || candidate.id.clock >= rangeEnd) break;
      if (!candidate.content) continue;
      const item = candidate as Item;
      if (!item.deleted) items.push(item);
    }
    return items;
  };
  const prepare = (stackItem: YjsStackItem | undefined): boolean => {
    protectCurrentStackItem = false;
    if (!stackItem) return false;
    stackItem.insertions.clients.forEach((ranges, client) => {
      ranges.forEach(({ clock, len }) => {
        for (const item of findInsertedItems(client, clock, len)) {
          const type = item && getContentType(item);
          const protectedItem =
            !!(item && type && hasForeignDescendant(type, localClientId, foreignTypes, new Set()));
          if (protectedItem) {
            protectCurrentStackItem = true;
          }
        }
      });
    });
    return protectCurrentStackItem;
  };
  const deleteFilter = (_item: Item): boolean => !protectCurrentStackItem;

  return {
    deleteFilter,
    prepare,
    dispose: () => binding.doc.off('afterTransaction', onAfterTransaction),
  };
};

export function registerYjsHistory(
  editor: LexicalEditor,
  binding: Binding,
  options: RegisterYjsHistoryOptions = {},
): () => void {
  const humanOrigin = options.humanOrigin ?? binding;
  // Do not include `null` here. Provider snapshots, remote updates, and
  // persistence replay commonly arrive with a provider/backend origin (or no
  // origin at all); neither may become a local browser's undo item. The
  // browser plugin wraps only user-authored syncs with `humanOrigin`.
  const undoManagerRef: { current: UndoManager | null } = { current: null };
  const foreignChangeFilter = createForeignChangeDeleteFilter(binding, humanOrigin, undoManagerRef);
  const undoManager = new UndoManager(binding.root.getSharedType(), {
    deleteFilter: foreignChangeFilter.deleteFilter,
    trackedOrigins: new Set([humanOrigin]),
  });
  undoManagerRef.current = undoManager;

  const updateUndoRedoState = () => {
    editor.dispatchCommand(CAN_UNDO_COMMAND, undoManager.undoStack.length > 0);
    editor.dispatchCommand(CAN_REDO_COMMAND, undoManager.redoStack.length > 0);
  };

  undoManager.on('stack-item-added', updateUndoRedoState);
  undoManager.on('stack-item-popped', updateUndoRedoState);
  undoManager.on('stack-cleared', updateUndoRedoState);

  // Lexical's HISTORY_PUSH_TAG defines a user-visible history boundary, while
  // Yjs otherwise coalesces transactions for its capture timeout. Registering
  // this listener before the Yjs editor-sync listener lets the boundary be
  // closed before the tagged transaction is written to the shared type.
  const stopCapturingAtLexicalBoundary = editor.registerUpdateListener(({ tags }) => {
    if (tags.has(HISTORY_PUSH_TAG)) undoManager.stopCapturing();
  });

  type StackOperationResult = 'performed' | 'noop' | 'protected';
  const runSingleStackItem = (redo: boolean): StackOperationResult => {
    const stack = redo ? undoManager.redoStack : undoManager.undoStack;
    const stackItem = stack.at(-1);
    if (!stackItem) return 'noop';

    // Yjs popStackItem loops over older items when the current item's filter
    // performs no change. Isolate the candidate so every actual item gets a
    // fresh foreign-content check and a protected item cannot be bypassed.
    const olderItems = stack.slice(0, -1);
    stack.length = 0;
    stack.push(stackItem);
    try {
      if (foreignChangeFilter.prepare(stackItem)) {
        stack.pop();
        return 'protected';
      }
      const performed = redo ? undoManager.redo() : undoManager.undo();
      return performed ? 'performed' : 'noop';
    } finally {
      const remainingItems = stack.splice(0);
      stack.push(...olderItems, ...remainingItems);
      foreignChangeFilter.prepare(undefined);
    }
  };

  const runStackOperation = (redo: boolean): void => {
    const stack = redo ? undoManager.redoStack : undoManager.undoStack;
    while (stack.length > 0) {
      const result = runSingleStackItem(redo);
      if (result !== 'noop') break;
    }
    updateUndoRedoState();
  };

  const unregisterUndo = editor.registerCommand(
    UNDO_COMMAND,
    () => {
      // Yjs owns history only while it has a local stack item. Returning
      // `true` for an empty stack keeps the regular Lexical history handler
      // from undoing initial hydration before provider sync or a remote
      // provider transaction after sync.
      if (undoManager.undoStack.length === 0) return true;
      runStackOperation(false);
      return true;
    },
    COMMAND_PRIORITY_CRITICAL,
  );

  const unregisterRedo = editor.registerCommand(
    REDO_COMMAND,
    () => {
      // Redo follows the same client-local ownership boundary as undo.
      if (undoManager.redoStack.length === 0) return true;
      runStackOperation(true);
      return true;
    },
    COMMAND_PRIORITY_CRITICAL,
  );

  return () => {
    unregisterUndo();
    unregisterRedo();
    stopCapturingAtLexicalBoundary();
    undoManager.off('stack-item-added', updateUndoRedoState);
    undoManager.off('stack-item-popped', updateUndoRedoState);
    undoManager.off('stack-cleared', updateUndoRedoState);
    undoManager.destroy();
    foreignChangeFilter.dispose();
  };
}
