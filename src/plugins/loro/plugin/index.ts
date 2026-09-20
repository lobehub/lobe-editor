import type { LexicalEditor } from 'lexical';
import type { LoroDoc } from 'loro-crdt';

import {
  type CollaborationDescriptor,
  type CollaborationEmbeddedText,
  type CollaborationEmbeddedTextChange,
  type CollaborationReadiness,
  type CollaborationService,
  type CollaborationTransportPort,
  ICollaborationService,
} from '@/common/collaboration';
import { KernelPlugin } from '@/editor-kernel/plugin';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { LoroLexicalBinding, type LoroLexicalBindingOptions } from '../binding';
import { createLoroCollaborationService } from '../collaboration-service';
import { registerLoroHistory } from '../history';
import type { LoroCanonicalDocument } from '../model';
import { getAttachedText } from '../model';
import type { LoroBindingDescriptor, LoroNodeCapability } from '../types';

export interface LoroPluginOptions {
  capabilities?: ReadonlyArray<LoroNodeCapability>;
  descriptor?: LoroBindingDescriptor;
  doc?: LoroCanonicalDocument | LoroDoc;
  hasAcceptedInitialSnapshot?: boolean;
  shouldBootstrap?: boolean;
  transport?: CollaborationTransportPort;
  transportFactory?: (
    canonical: LoroCanonicalDocument,
    binding: LoroLexicalBinding,
  ) => CollaborationTransportPort;
}

/**
 * Readiness bridge: socket sync and Loro projection are separate barriers.
 * The neutral service becomes ready only after both have completed.
 */
class LoroPluginCollaborationService implements CollaborationService {
  readonly descriptor: CollaborationDescriptor;
  readonly document;
  readonly transport: CollaborationTransportPort;
  private transportReady: boolean;
  private disposed = false;
  private readonly awarenessUsers = new Map<string, unknown>();
  private readonly awarenessListeners = new Set<(users: readonly unknown[]) => void>();
  private readonly listeners = new Set<() => void>();
  private readonly readinessListeners = new Set<(readiness: CollaborationReadiness) => void>();
  private readonly presenceDisposer: (() => void) | undefined;
  private readonly presenceStatusDisposer: (() => void) | undefined;

  constructor(
    private readonly delegate: CollaborationService,
    transportReady: boolean,
    private readonly binding: LoroLexicalBinding,
  ) {
    this.descriptor = delegate.descriptor;
    this.document = delegate.document;
    this.transport = delegate.transport;
    this.transportReady = transportReady;
    this.presenceDisposer = this.transport.onPresence?.((presence) => {
      if (presence.state === null) this.awarenessUsers.delete(presence.peerId);
      else this.awarenessUsers.set(presence.peerId, normalizePresenceUser(presence));
      const users = [...this.awarenessUsers.values()];
      this.awarenessListeners.forEach((listener) => listener(users));
    });
    this.presenceStatusDisposer = this.transport.onStatus((status) => {
      if (status !== 'disconnected') return;
      this.awarenessUsers.clear();
      this.awarenessListeners.forEach((listener) => listener([]));
    });
  }

  capturePoint(...args: Parameters<CollaborationService['capturePoint']>) {
    return this.delegate.capturePoint(...args);
  }

  getAnnotations() {
    return this.delegate.getAnnotations();
  }

  getAwarenessUsers(): readonly unknown[] {
    return this.delegate.getAwarenessUsers?.() ?? [...this.awarenessUsers.values()];
  }

  getEmbeddedText(nodeId: string): CollaborationEmbeddedText | null {
    const node = this.binding.canonical.findNodeById(nodeId);
    const body = node ? getAttachedText(node, 'body') : null;
    if (!body) return null;
    return {
      applyLocalChange: (from, to, insert) => {
        applyEmbeddedChanges(body, [{ from, insert, to }], this.binding);
      },
      applyLocalChanges: (changes) => applyEmbeddedChanges(body, changes, this.binding),
      id: body.id,
      onChange: (listener) =>
        this.binding.canonical.subscribe((event) => {
          if (event.events.some((change) => change.target === body.id)) listener();
        }),
      read: () => body.toString(),
      redo: () => this.binding.redo(),
      undo: () => this.binding.undo(),
    };
  }

  subscribeAwarenessUsers(listener: (users: readonly unknown[]) => void): () => void {
    this.awarenessListeners.add(listener);
    listener(this.getAwarenessUsers());
    return () => this.awarenessListeners.delete(listener);
  }

  getLexicalEditor() {
    return this.delegate.getLexicalEditor();
  }

  getReadiness(): CollaborationReadiness {
    if (this.disposed) return 'disposed';
    const delegateReadiness = this.delegate.getReadiness();
    if (delegateReadiness === 'incompatible') return 'incompatible';
    if (delegateReadiness === 'disposed') return 'disposed';
    if (!this.transportReady || delegateReadiness !== 'ready') return 'initializing';
    return 'ready';
  }

  getVersionProof() {
    return this.delegate.getVersionProof();
  }

  resolveAnchorOffset(...args: Parameters<CollaborationService['resolveAnchorOffset']>) {
    return this.delegate.resolveAnchorOffset(...args);
  }

  resolvePoints(...args: Parameters<CollaborationService['resolvePoints']>) {
    return this.delegate.resolvePoints(...args);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    const unsubscribe = this.delegate.subscribe(listener);
    return () => {
      this.listeners.delete(listener);
      unsubscribe();
    };
  }

  subscribeReadiness(listener: (readiness: CollaborationReadiness) => void): () => void {
    this.readinessListeners.add(listener);
    listener(this.getReadiness());
    const unsubscribeDelegate = this.delegate.subscribeReadiness(() =>
      listener(this.getReadiness()),
    );
    return () => {
      this.readinessListeners.delete(listener);
      unsubscribeDelegate();
    };
  }

  setTransportReady(ready: boolean): void {
    this.transportReady = ready;
    const readiness = this.getReadiness();
    this.readinessListeners.forEach((listener) => listener(readiness));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.transportReady = false;
    this.delegate.dispose();
    this.presenceDisposer?.();
    this.presenceStatusDisposer?.();
    this.awarenessUsers.clear();
    this.awarenessListeners.clear();
    this.listeners.clear();
    this.readinessListeners.clear();
  }
}

const normalizePresenceUser = (presence: {
  peerId: string;
  state: unknown | null;
}): { clientId: string; state: Record<string, unknown> } => {
  const envelope = isRecord(presence.state) ? presence.state : {};
  const state = isRecord(envelope.state) ? envelope.state : envelope;
  const awarenessData = isRecord(state.awarenessData) ? state.awarenessData : state;
  return {
    clientId: presence.peerId,
    state: {
      ...state,
      awarenessData,
      anchorPos: null,
      focusPos: null,
      color: typeof state.color === 'string' ? state.color : '#7c3aed',
      focusing:
        typeof state.focusing === 'boolean'
          ? state.focusing
          : awarenessData.status !== 'done' && awarenessData.status !== 'error',
      name: typeof state.name === 'string' ? state.name : 'AI Agent',
    },
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const applyEmbeddedChanges = (
  body: ReturnType<typeof getAttachedText>,
  changes: readonly CollaborationEmbeddedTextChange[],
  binding: LoroLexicalBinding,
): void => {
  if (!body) return;
  binding.runLocalTransaction('loro:embedded/local', () => {
    let adjustment = 0;
    for (const change of changes) {
      const start = Math.max(0, Math.min(change.from + adjustment, body.length));
      const end = Math.max(start, Math.min(change.to + adjustment, body.length));
      if (end > start) body.delete(start, end - start);
      if (change.insert) body.insert(start, change.insert);
      adjustment += change.insert.length - (change.to - change.from);
    }
  });
};

export const LoroPlugin: IEditorPluginConstructor<LoroPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<LoroPluginOptions>
{
  static pluginName = 'LoroPlugin';

  private collaborationService: LoroPluginCollaborationService | null = null;
  private binding: LoroLexicalBinding | null = null;
  private transportDisposer: (() => void) | null = null;

  constructor(
    protected kernel: IEditorKernel,
    public config?: LoroPluginOptions,
  ) {
    super();
  }

  onInit(editor: LexicalEditor): void {
    const config = this.config ?? {};
    const bindingOptions: LoroLexicalBindingOptions = {
      capabilities: config.capabilities,
      descriptor: config.descriptor,
      doc: config.doc,
      editor,
      hasAcceptedInitialSnapshot: config.hasAcceptedInitialSnapshot,
      shouldBootstrap: config.shouldBootstrap,
    };
    const binding = new LoroLexicalBinding(bindingOptions);
    const transport = config.transport ?? config.transportFactory?.(binding.canonical, binding);
    const delegate = createLoroCollaborationService(binding, transport);
    const bridge = new LoroPluginCollaborationService(delegate, !transport, binding);
    this.binding = binding;
    this.collaborationService = bridge;
    this.kernel.registerServiceHotReload(ICollaborationService, bridge);
    this.register(registerLoroHistory(editor, binding));

    if (transport) {
      this.transportDisposer = transport.onSync((synced) => bridge.setTransportReady(synced));
      this.register(() => this.transportDisposer?.());
      this.register(() => void transport.disconnect());
      void transport.connect();
    }

    this.register(() => {
      bridge.dispose();
      this.binding = null;
      this.collaborationService = null;
    });
  }

  destroy(): void {
    this.transportDisposer?.();
    this.transportDisposer = null;
    super.destroy();
  }
};

export type LoroEditorPlugin = typeof LoroPlugin;
