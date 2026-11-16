import type { CollaborationWebSocketConstructor } from '@/common/collaboration/transport/core';

/**
 * Transport options shared by the Loro provider and the neutral headless
 * facade. Keeping this leaf free of Loro runtime imports prevents default
 * headless declarations from requiring the optional peer.
 */
export interface LoroTransportProviderOptions {
  /** Binding-owned gate for both the initial snapshot and incremental updates. */
  applyRemoteUpdate?: (update: Uint8Array) => void;
  /** Explicit escape hatch for standalone canonical transport tests/adapters. */
  allowStandaloneCanonicalImport?: boolean;
  autoReconnect?: boolean;
  clientKind?: 'agent' | 'browser';
  documentId?: string;
  maxSeenMessageIds?: number;
  refreshTicket?: () => string | Promise<string>;
  requestId?: string;
  ticket: string;
  webSocketConstructor?: CollaborationWebSocketConstructor;
  wsBaseUrl: string;
}
