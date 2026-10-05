import { type CollaborationService, ICollaborationService } from '@/common/collaboration';
import type { IEditor } from '@/types';

/**
 * Headless code consumes this narrow port instead of identifying Yjs/Loro.
 * The concrete engine plugin registers the service on the editor kernel; a
 * missing service is a real unsupported-binding state, never a guessed Yjs
 * fallback for a descriptor that was supplied by the caller.
 */
export const getCollaborationEngine = (editor: IEditor): CollaborationService | null =>
  editor.requireService(ICollaborationService);

export const requireCollaborationEngine = (editor: IEditor): CollaborationService => {
  const service = getCollaborationEngine(editor);
  if (!service) throw new Error('Collaboration engine service is not registered.');
  return service;
};
