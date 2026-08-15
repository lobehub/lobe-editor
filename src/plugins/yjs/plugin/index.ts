import {
  type Binding,
  CONNECTED_COMMAND,
  type Provider,
  TOGGLE_CONNECT_COMMAND,
  createBinding,
  syncLexicalUpdateToYjs,
  syncYjsChangesToLexical,
} from '@lexical/yjs';
import {
  $getRoot,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_CRITICAL,
  type LexicalEditor,
  SKIP_COLLAB_TAG,
} from 'lexical';
import type { Doc, YEvent, Text as YText } from 'yjs';
import { UndoManager } from 'yjs';

import { KernelPlugin } from '@/editor-kernel/plugin';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { IYjsService, YjsService } from '../service';
import type { YjsPluginOptions } from './types';
import { getAwarenessUsers } from './utils/awareness';
import { clearEditorSkipCollab, initializeEditor } from './utils/editor-state';
import { registerYjsHistory } from './utils/history';
import {
  ensureYjsNodePropertiesFromEditorState,
  initializeYjsNodeProperties,
} from './utils/node-properties';
import { hydrateLexicalFromYjsState, syncCurrentEditorStateToYjs } from './utils/sync';

export type { YjsInitialEditorState, YjsPluginOptions, YjsProviderFactory } from './types';

type OnYjsTreeChanges = (events: Array<YEvent<YText>>, transaction: YjsTransaction) => void;

type YjsTransaction = {
  origin: unknown;
};

interface ConnectionState {
  connection: Promise<void> | void;
  hasConnected: boolean;
}

interface SyncState {
  documentHasChanged: boolean;
  providerHasSynced: boolean;
}

export const YjsPlugin: IEditorPluginConstructor<YjsPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<YjsPluginOptions>
{
  static pluginName = 'YjsPlugin';

  private bootstrapCurrentEditorState: (() => void) | null = null;
  private docMap = new Map<string, Doc>();
  private hasInitialized = false;
  private isReloadingDoc = false;
  private markDocumentChanged: (() => void) | null = null;
  private service = new YjsService();

  constructor(
    protected kernel: IEditorKernel,
    public config?: YjsPluginOptions,
  ) {
    super();
    kernel.registerServiceHotReload(IYjsService, this.service);
  }

  destroy(): void {
    super.destroy();
    this.bootstrapCurrentEditorState = null;
    this.markDocumentChanged = null;
    this.service.setState(null);
  }

  onDocumentChange(): void {
    this.markDocumentChanged?.();
  }

  private connectProvider(provider: Provider, connectionState: ConnectionState): void {
    // Start document-level sync after listeners are registered and the document is ready.
    if (connectionState.hasConnected) {
      return;
    }

    connectionState.hasConnected = true;
    connectionState.connection = provider.connect();
  }

  private registerAwareness(provider: Provider): void {
    this.service.setAwarenessUsers(getAwarenessUsers(provider));

    const updateAwarenessUsers = () => {
      this.service.setAwarenessUsers(getAwarenessUsers(provider));
    };

    provider.awareness.on('update', updateAwarenessUsers);

    this.register(() => {
      provider.awareness.off('update', updateAwarenessUsers);
      this.service.setAwarenessUsers([]);
    });
  }

  private registerEditorSync(
    editor: LexicalEditor,
    binding: Binding,
    provider: Provider,
    shouldBootstrap: boolean,
    syncState: SyncState,
  ): void {
    this.register(
      editor.registerUpdateListener(
        ({ dirtyElements, dirtyLeaves, editorState, normalizedNodes, prevEditorState, tags }) => {
          if (tags.has(SKIP_COLLAB_TAG) || tags.has(COLLABORATION_TAG)) {
            return;
          }

          // Ignore local editor updates until the provider has reported its initial sync state.
          if (!syncState.providerHasSynced) {
            return;
          }

          ensureYjsNodePropertiesFromEditorState(binding, editorState);

          if (
            shouldBootstrap &&
            syncState.providerHasSynced &&
            binding.root.isEmpty() &&
            binding.root._xmlText._length === 0
          ) {
            const isEditorEmpty = editorState.read(() => $getRoot().isEmpty());

            if (!isEditorEmpty) {
              syncCurrentEditorStateToYjs(binding, provider);
              return;
            }
          }

          syncLexicalUpdateToYjs(
            binding,
            provider,
            prevEditorState,
            editorState,
            dirtyElements,
            dirtyLeaves,
            normalizedNodes,
            tags,
          );
        },
      ),
    );
  }

  private registerProviderEvents(
    editor: LexicalEditor,
    binding: Binding,
    provider: Provider,
    id: string,
    syncState: SyncState,
  ): void {
    const onProviderDocReload = (doc: Doc) => {
      clearEditorSkipCollab(editor);
      this.docMap.set(id, doc);
      this.isReloadingDoc = true;
      this.service.setState({
        binding,
        doc,
        docMap: this.docMap,
        id,
        provider,
      });
    };

    const onStatus = ({ status }: { status: string }) => {
      editor.dispatchCommand(CONNECTED_COMMAND, status === 'connected');
    };

    const onSync = (isSynced: boolean) => {
      if (!isSynced) {
        return;
      }

      syncState.providerHasSynced = true;

      if (this.isReloadingDoc) {
        this.isReloadingDoc = false;
        return;
      }

      if (binding.root.isEmpty() && binding.root._xmlText._length > 0) {
        hydrateLexicalFromYjsState(binding);
        return;
      }

      this.bootstrapCurrentEditorState?.();
    };

    provider.on('reload', onProviderDocReload);
    provider.on('status', onStatus);
    provider.on('sync', onSync);

    this.register(() => {
      provider.off('reload', onProviderDocReload);
      provider.off('status', onStatus);
      provider.off('sync', onSync);
      this.bootstrapCurrentEditorState = null;
      this.markDocumentChanged = null;
    });
  }

  private registerProviderToggleCommand(editor: LexicalEditor, provider: Provider): void {
    this.register(
      editor.registerCommand(
        TOGGLE_CONNECT_COMMAND,
        (shouldConnect) => {
          if (shouldConnect) {
            provider.connect();
          } else {
            provider.disconnect();
          }

          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
  }

  private registerProviderTeardown(
    binding: Binding,
    provider: Provider,
    connectionState: ConnectionState,
  ): void {
    this.register(() => {
      if (connectionState.connection) {
        connectionState.connection.then(() => provider.disconnect());
      } else if (connectionState.hasConnected) {
        provider.disconnect();
      }

      binding.root.destroy(binding);
      this.service.setState(null);
    });
  }

  private registerYjsTreeSync(binding: Binding, provider: Provider): void {
    const onYjsTreeChanges: OnYjsTreeChanges = (events, transaction) => {
      if (transaction.origin === binding) {
        return;
      }

      syncYjsChangesToLexical(
        binding,
        provider,
        events,
        transaction.origin instanceof UndoManager,
        () => undefined,
      );
    };

    binding.root.getSharedType().observeDeep(onYjsTreeChanges);

    this.register(() => {
      binding.root.getSharedType().unobserveDeep(onYjsTreeChanges);
    });
  }

  private setBootstrapCurrentEditorState(
    editor: LexicalEditor,
    binding: Binding,
    provider: Provider,
    initialEditorState: YjsPluginOptions['initialEditorState'],
    shouldBootstrap: boolean,
    syncState: SyncState,
  ): void {
    this.bootstrapCurrentEditorState = () => {
      // Bootstrap only after both sides are ready: provider sync and local document load.
      if (
        !shouldBootstrap ||
        !syncState.providerHasSynced ||
        (!syncState.documentHasChanged && !initialEditorState) ||
        !binding.root.isEmpty() ||
        binding.root._xmlText._length !== 0
      ) {
        return;
      }

      const isEditorEmpty = editor.getEditorState().read(() => $getRoot().isEmpty());

      if (isEditorEmpty && !initialEditorState) {
        return;
      }

      if (initialEditorState) {
        clearEditorSkipCollab(editor);
        initializeEditor(editor, initialEditorState, {
          discrete: true,
          skipIfNotEmpty: false,
          tag: undefined,
        });
      }

      syncCurrentEditorStateToYjs(binding, provider);
    };
  }

  private setServiceState(binding: Binding, id: string, provider: Provider, doc?: Doc): void {
    this.service.setState({
      binding,
      doc,
      docMap: this.docMap,
      id,
      provider,
    });
  }

  onInit(editor: LexicalEditor): void {
    const {
      excludedProperties,
      id,
      initialEditorState,
      providerFactory,
      shouldBootstrap = true,
      yjsDoc,
    } = this.config || {};

    if (!id || !providerFactory) {
      throw new Error('YjsPlugin requires both "id" and "providerFactory".');
    }

    if (this.hasInitialized) {
      return;
    }

    this.hasInitialized = true;

    if (yjsDoc) {
      this.docMap.set(id, yjsDoc);
    }

    const provider = providerFactory(id, this.docMap);
    const connectionState: ConnectionState = {
      connection: undefined,
      hasConnected: false,
    };
    const syncState: SyncState = {
      documentHasChanged: false,
      providerHasSynced: false,
    };
    const binding = createBinding(
      editor,
      provider,
      id,
      this.docMap.get(id),
      this.docMap,
      excludedProperties,
    );
    initializeYjsNodeProperties(binding);

    this.setServiceState(binding, id, provider, this.docMap.get(id));
    this.registerAwareness(provider);
    this.registerYjsTreeSync(binding, provider);
    this.registerEditorSync(editor, binding, provider, shouldBootstrap, syncState);
    this.setBootstrapCurrentEditorState(
      editor,
      binding,
      provider,
      initialEditorState,
      shouldBootstrap,
      syncState,
    );

    this.markDocumentChanged = () => {
      syncState.documentHasChanged = true;
      // setDocument has completed; it is now safe to start provider sync.
      this.connectProvider(provider, connectionState);
      this.bootstrapCurrentEditorState?.();
    };

    this.registerProviderEvents(editor, binding, provider, id, syncState);
    this.registerProviderToggleCommand(editor, provider);
    this.register(registerYjsHistory(editor, binding));

    if (initialEditorState) {
      this.connectProvider(provider, connectionState);
    }

    this.registerProviderTeardown(binding, provider, connectionState);
  }
};
