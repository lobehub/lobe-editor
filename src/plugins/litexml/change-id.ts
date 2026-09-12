import { createDeterministicNodeId } from '@/plugins/properties/state';

/**
 * Older table diffs persisted Lexical keys in their pairing token. Convert
 * those shapes to an opaque deterministic UUID at the JSON/Yjs import edge so
 * a reload cannot re-expose a runtime key or split an existing pair.
 */
const LEGACY_CHANGE_ID = /^(?:\d+:\d+|\d+:column:\d+|legacy-table-cell-\d+)$/u;

export const normalizeLiteXMLChangeId = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const changeId = value.trim();
  if (!LEGACY_CHANGE_ID.test(changeId)) return changeId;
  return createDeterministicNodeId(`legacy-litexml-change-id:v1:${changeId}`);
};
