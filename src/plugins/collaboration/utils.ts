import type { BindingV2, ExcludedProperties, Provider, SyncCursorPositionsFn } from '@lexical/yjs';
import {
  createBindingV2__EXPERIMENTAL,
  initLocalState,
  syncCursorPositions,
  syncLexicalUpdateToYjsV2__EXPERIMENTAL,
  syncYjsChangesToLexicalV2__EXPERIMENTAL,
  syncYjsStateToLexicalV2__EXPERIMENTAL,
} from '@lexical/yjs';
import type { LexicalEditor } from 'lexical';
import { COLLABORATION_TAG } from 'lexical';
import type { Doc, Transaction, XmlElement, XmlText, YEvent } from 'yjs';

export interface CollaborationUser {
  awarenessData?: Record<string, unknown>;
  color: string;
  focusing?: boolean;
  name: string;
}

export interface CollaborationBindingOptions {
  cursorContainer?: HTMLElement | null;
  doc: Doc;
  excludedProperties?: ExcludedProperties;
  id: string;
  lexicalEditor: LexicalEditor;
  provider: Provider;
  shouldBootstrap?: boolean;
  syncCursorPositionsFn?: SyncCursorPositionsFn;
  yjsDocMap: Map<string, Doc>;
}

export interface CollaborationBindingHandle {
  binding: BindingV2;
  cleanup: () => void;
}

export const getOrCreateYDoc = (id: string, yjsDocMap: Map<string, Doc>, createDoc: () => Doc) => {
  const existingDoc = yjsDocMap.get(id);
  if (existingDoc) return existingDoc;

  const doc = createDoc();
  yjsDocMap.set(id, doc);
  return doc;
};

export const initializeCollaborationUser = (provider: Provider, user: CollaborationUser) => {
  initLocalState(provider, user.name, user.color, user.focusing ?? true, user.awarenessData ?? {});
};

const isStaleLexicalNodeError = (error: unknown) =>
  error instanceof Error &&
  error.message.includes('Lexical node does not exist in active editor state');

const flushBindingNodeProperties = (lexicalEditor: LexicalEditor) => {
  lexicalEditor.update(() => {}, { discrete: true });
};

export const registerCollaborationBinding = ({
  cursorContainer,
  doc,
  excludedProperties,
  id,
  lexicalEditor,
  provider,
  shouldBootstrap = false,
  syncCursorPositionsFn = syncCursorPositions,
  yjsDocMap,
}: CollaborationBindingOptions): CollaborationBindingHandle => {
  const binding = createBindingV2__EXPERIMENTAL(lexicalEditor, id, doc, yjsDocMap, {
    excludedProperties,
  });
  flushBindingNodeProperties(lexicalEditor);
  binding.cursorsContainer = cursorContainer ?? null;

  const rootHasContent = binding.root.length > 0;

  if (rootHasContent) {
    syncYjsStateToLexicalV2__EXPERIMENTAL(binding, provider);
  } else if (shouldBootstrap) {
    const editorState = lexicalEditor.getEditorState();
    syncLexicalUpdateToYjsV2__EXPERIMENTAL(
      binding,
      provider,
      editorState,
      editorState,
      new Map([['root', true]]),
      new Set(),
      new Set(),
    );
  }

  const yjsObserver = (events: Array<YEvent<XmlElement | XmlText>>, transaction: Transaction) => {
    if (transaction.origin === binding) return;
    syncYjsChangesToLexicalV2__EXPERIMENTAL(binding, provider, events, transaction, false);
  };

  let isCleanedUp = false;
  let cursorSyncQueued = false;
  let cursorSyncRetryQueued = false;
  const syncCursorsSafely = () => {
    try {
      syncCursorPositionsFn(binding, provider);
    } catch (error) {
      if (!isStaleLexicalNodeError(error)) {
        throw error;
      }

      if (cursorSyncRetryQueued) return;

      cursorSyncRetryQueued = true;
      syncYjsStateToLexicalV2__EXPERIMENTAL(binding, provider);
      setTimeout(() => {
        cursorSyncRetryQueued = false;
        if (isCleanedUp) return;

        try {
          syncCursorPositionsFn(binding, provider);
        } catch (retryError) {
          if (!isStaleLexicalNodeError(retryError)) {
            throw retryError;
          }
        }
      }, 0);
    }
  };

  const scheduleCursorSync = () => {
    if (cursorSyncQueued) return;

    cursorSyncQueued = true;
    setTimeout(() => {
      cursorSyncQueued = false;
      if (isCleanedUp) return;

      syncCursorsSafely();
    }, 0);
  };

  const awarenessObserver = () => {
    scheduleCursorSync();
  };

  const unregisterUpdateListener = lexicalEditor.registerUpdateListener(
    ({ dirtyElements, editorState, normalizedNodes, prevEditorState, tags }) => {
      syncLexicalUpdateToYjsV2__EXPERIMENTAL(
        binding,
        provider,
        prevEditorState,
        editorState,
        dirtyElements,
        normalizedNodes,
        tags,
      );
      scheduleCursorSync();
    },
  );

  binding.root.observeDeep(yjsObserver);
  provider.awareness.on('update', awarenessObserver);

  return {
    binding,
    cleanup: () => {
      isCleanedUp = true;
      unregisterUpdateListener();
      binding.root.unobserveDeep(yjsObserver);
      provider.awareness.off('update', awarenessObserver);
      lexicalEditor.update(() => {}, { tag: COLLABORATION_TAG });
      binding.cursorsContainer = null;
    },
  };
};
