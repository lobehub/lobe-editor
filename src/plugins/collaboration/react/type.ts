import type { ExcludedProperties, Provider, SyncCursorPositionsFn } from '@lexical/yjs';
import type { Doc } from 'yjs';

import type { CollaborationUser } from '../utils';

export type CollaborationProviderFactory = (id: string, yjsDocMap: Map<string, Doc>) => Provider;

export interface EditorCollaborationConfig {
  /**
   * Whether the provider should connect immediately.
   * Set this to false when the business shell needs to create the editor before joining the room.
   *
   * @default true
   */
  connect?: boolean;
  /**
   * Optional DOM node used by Lexical/Yjs to render remote cursor overlays.
   * When omitted, the editor creates and owns a cursor container beside the root element.
   */
  cursorContainer?: HTMLElement | null;
  /**
   * Lexical node properties excluded from Yjs synchronization.
   */
  excludedProperties?: ExcludedProperties;
  /**
   * Stable collaboration room id. For workspace pages, this should be derived from
   * workspaceId + pageId by the business shell.
   */
  id: string;
  /**
   * Provider connection status callback.
   */
  onStatusChange?: (status: string) => void;
  /**
   * Provider sync state callback.
   */
  onSync?: (isSynced: boolean) => void;
  /**
   * Factory that adapts the business collaboration transport to Lexical's Provider contract.
   */
  providerFactory: CollaborationProviderFactory;
  /**
   * Bootstrap the current Lexical editor state into Yjs only when the Y.Doc root is empty.
   * Use this for lazy migration from legacy page JSON.
   *
   * @default false
   */
  shouldBootstrap?: boolean;
  syncCursorPositionsFn?: SyncCursorPositionsFn;
  /**
   * Current user's collaboration identity and awareness metadata.
   */
  user: CollaborationUser;
  /**
   * Optional externally-owned Y.Doc registry. Supplying this lets the business shell
   * control document lifetime across page mounts.
   */
  yjsDocMap?: Map<string, Doc>;
}

export type ReactCollaborationPluginProps = EditorCollaborationConfig;
