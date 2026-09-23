import type { LexicalNode } from 'lexical';

/** JSON values accepted by node properties and annotation payloads. */
export type JSONValue =
  boolean | null | number | string | JSONValue[] | { [key: string]: JSONValue };

export interface NodeProvenance {
  createdAt?: string;
  generationId?: string;
  model?: string;
  provider?: string;
  requestId?: string;
  sessionId?: string;
  source: 'ai' | 'human';
  turnIndex?: number;
}

export interface NodeProperties {
  annotationIds?: string[];
  /**
   * Durable identity for a block that may be addressed across editor
   * instances, reloads, and collaborative clients. This is deliberately
   * separate from Lexical's runtime node key.
   */
  nodeId?: string;
  provenance?: NodeProvenance;
  [key: string]: JSONValue | NodeProvenance | string[] | undefined;
}

export type AnnotationStatus = 'active' | 'resolved' | 'orphaned';

export interface AnnotationRecord {
  author?: JSONValue;
  createdAt: string;
  id: string;
  kind: string;
  payload: JSONValue;
  quotedText: string;
  status: AnnotationStatus;
  updatedAt: string;
  /** Internal anchor bookkeeping. It is intentionally optional for wire compatibility. */
  nodeKeys?: string[];
}

export type NodePropertiesUpdater =
  NodeProperties | ((previous: NodeProperties, node: LexicalNode) => NodeProperties);

export interface CreateAnnotationPayload {
  author?: JSONValue;
  id?: string;
  kind?: string;
  nodeIds?: string[];
  nodeKeys?: string[];
  payload?: JSONValue;
  quotedText?: string;
  selection?: unknown;
}

export interface UpdateAnnotationPayload {
  id: string;
  patch: Partial<Omit<AnnotationRecord, 'createdAt' | 'id'>>;
}

export interface ResolveAnnotationPayload {
  id: string;
  status?: 'active' | 'resolved';
}

export interface MarkAIGeneratedPayload {
  createdAt?: string;
  generationId: string;
  model?: string;
  nodeIds?: string[];
  nodeKeys?: string[];
  provenanceSessionId?: string;
  provider?: string;
  requestId?: string;
  selection?: unknown;
  turnIndex?: number;
}

export interface SetNodePropertiesPayload {
  nodeIds?: string[];
  nodeKeys?: string[];
  properties: NodePropertiesUpdater;
  selection?: unknown;
}
