import type { LexicalNode } from 'lexical';

import { genServiceId } from '@/editor-kernel';
import type { IEditorKernel, IServiceID } from '@/types';

import type { AnnotationMap } from './annotation';

/**
 * A collaboration provider may be present before its binding has completed
 * the first room sync. Properties must treat that state differently from a
 * standalone editor so a local identity cannot win a later CRDT migration.
 */
export type PropertiesCollaborationReadiness = 'initializing' | 'ready';

/**
 * Minimal annotation storage port passed to a collaboration provider. The
 * legacy AnnotationService API remains unchanged; providers only need this
 * optional transport bridge to attach and detach a shared map safely.
 */
export interface PropertiesAnnotationStorage {
  /** `owner` is an opaque registration token used to reject stale cleanup. */
  attachMap(map: AnnotationMap, owner?: object): void;
  /** A detach with a different owner or map is intentionally ignored. */
  detachMap(map?: AnnotationMap, owner?: object): void;
}

/**
 * The small collaboration surface needed by PropertiesPlugin. Implementations
 * own their transport, shared maps, and binding internals; Properties only
 * consumes readiness and stable identity and gives the provider its annotation
 * service to attach when a shared store is available.
 */
export interface PropertiesCollaborationProvider {
  /** Attach the provider-owned annotation store; the returned disposer is idempotent. */
  attachAnnotationStorage(storage: PropertiesAnnotationStorage): () => void;
  /** Return the stable seed for one mapped node, when the binding is ready. */
  getNodeIdentity(node: LexicalNode): string | undefined;
  /** `initializing` blocks local legacy migration; `ready` permits it. */
  getReadiness(): PropertiesCollaborationReadiness;
  /** Notify Properties when binding state/readiness changes; called immediately. */
  subscribe(listener: () => void): () => void;
}

/**
 * Editor-scoped registration surface for collaboration integrations.
 *
 * Registration does not alter the existing `properties` NodeState, serialized
 * JSON metadata, or annotation service API. A null provider means ordinary
 * standalone behavior; an installed provider must be disposed before another
 * provider can claim the editor, and its disposer is safe to call repeatedly.
 */
export interface IPropertiesService {
  /** Null when Properties is operating without collaboration. */
  getCollaborationProvider(): PropertiesCollaborationProvider | null;
  /** Register one provider; duplicate active registrations are unsupported. */
  registerCollaborationProvider(provider: PropertiesCollaborationProvider): () => void;
  /** Subscribe to provider install/removal; the current value is delivered immediately. */
  subscribeCollaborationProvider(
    listener: (provider: PropertiesCollaborationProvider | null) => void,
  ): () => void;
}

export const IPropertiesService: IServiceID<IPropertiesService> = genServiceId('PropertiesService');

/**
 * Editor-scoped registry for collaboration integrations. There is deliberately
 * one active provider: two bindings cannot safely compete for the same
 * annotation store or identity migration. Reconfiguration must dispose the
 * old registration before installing a new one.
 */
export class PropertiesService implements IPropertiesService {
  private collaborationProvider: PropertiesCollaborationProvider | null = null;
  private readonly collaborationListeners = new Set<
    (provider: PropertiesCollaborationProvider | null) => void
  >();

  getCollaborationProvider(): PropertiesCollaborationProvider | null {
    return this.collaborationProvider;
  }

  registerCollaborationProvider(provider: PropertiesCollaborationProvider): () => void {
    if (this.collaborationProvider) {
      throw new Error('PropertiesService supports only one collaboration provider.');
    }

    this.collaborationProvider = provider;
    this.notifyCollaborationListeners();

    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;

      // A stale disposer must never unregister a newer provider. Normally a
      // caller cannot install the newer provider until it has disposed this
      // one, but the identity check also makes cleanup safe during teardown.
      if (this.collaborationProvider !== provider) return;
      this.collaborationProvider = null;
      this.notifyCollaborationListeners();
    };
  }

  subscribeCollaborationProvider(
    listener: (provider: PropertiesCollaborationProvider | null) => void,
  ): () => void {
    this.collaborationListeners.add(listener);
    listener(this.collaborationProvider);
    return () => {
      this.collaborationListeners.delete(listener);
    };
  }

  private notifyCollaborationListeners(): void {
    this.collaborationListeners.forEach((listener) => listener(this.collaborationProvider));
  }
}

/**
 * Plugins can obtain the registry before PropertiesPlugin itself is mounted.
 * This is what makes Yjs-first and late Properties registration equivalent to
 * the ordinary Properties-first order without adding a kernel-wide service
 * discovery event.
 */
export function getOrCreatePropertiesService(kernel: IEditorKernel): IPropertiesService {
  const existing = kernel.requireService(IPropertiesService);
  if (existing) return existing;

  const service = new PropertiesService();
  kernel.registerServiceHotReload(IPropertiesService, service);
  return service;
}
