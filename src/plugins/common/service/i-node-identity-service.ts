import type { IServiceID } from '@/types';

/** A detached, immutable description of the currently active logical node. */
export interface NodeIdentitySnapshot {
  readonly id: string;
  /** Native Lexical text; a review container can include both pending sides. */
  readonly textContent: string;
  readonly type: string;
}

export interface INodeIdentityService {
  /** Read the last committed editor state without retaining a LexicalNode. */
  getNodeById(nodeId: string): Readonly<NodeIdentitySnapshot> | null;
  /** Subscribe to committed updates; query the service in the callback. */
  subscribe(listener: () => void): () => void;
}

// Keep this token side-effect-free so bundled headless and unbundled UI builds
// can both import the same emitted module instead of creating duplicate objects.
export const INodeIdentityService: IServiceID<INodeIdentityService> = {
  __serviceId: 'NodeIdentityService',
};
