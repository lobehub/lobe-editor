import type { ElementNode, LexicalNode, TextNode } from 'lexical';
import type { ContainerID, LoroMap, LoroText, TreeID } from 'loro-crdt';

import {
  type CollaborationDescriptor,
  parseCollaborationDescriptor,
} from '@/common/collaboration/protocol';

/**
 * The descriptor is intentionally structural so the shared public contract
 * can be supplied by the collaboration package without making this plugin
 * own a second descriptor definition.
 */
export type LoroBindingDescriptor = CollaborationDescriptor & {
  readonly bindingSchema: 'lexical-loro-v1';
  readonly engine: 'loro';
};

export const createLoroBindingDescriptor = (epoch = 0): LoroBindingDescriptor => {
  if (!Number.isSafeInteger(epoch) || epoch < 0) {
    throw new RangeError('Loro binding epoch must be a non-negative safe integer.');
  }

  return Object.freeze(
    parseCollaborationDescriptor({
      bindingSchema: 'lexical-loro-v1' as const,
      engine: 'loro' as const,
      epoch,
    }) as LoroBindingDescriptor,
  );
};

export type LoroNodeRole = 'atom' | 'block-decorator' | 'element' | 'inline';

export interface LoroNodeData {
  attrs: Record<string, unknown>;
  body?: LoroText;
  containerId: ContainerID;
  flow?: LoroText;
  nodeId?: string;
  properties: Record<string, unknown>;
  role: LoroNodeRole;
  treeId: TreeID;
  type: string;
}

export interface LoroNodeCapability {
  allowedParents?: readonly string[] | ((parentType: string | undefined) => boolean);
  attrs?: readonly string[];
  create: (data: LoroNodeData) => LexicalNode;
  embeddedText?: 'body';
  flowOwner?: boolean;
  applyAttrs?: (
    node: LexicalNode,
    attrs: Record<string, unknown>,
    previousAttrs?: Record<string, unknown>,
  ) => void;
  readAttrs?: (node: LexicalNode) => Record<string, unknown>;
  role: LoroNodeRole;
  type: string;
}

export interface LoroTextFlowCapability {
  isFlowOwner: (node: ElementNode) => boolean;
  readInlineMarks?: (node: LexicalNode) => Readonly<Record<string, unknown>>;
  readTextNode?: (node: TextNode) => Readonly<Record<string, unknown>>;
}

export interface LoroBindingReadiness {
  phase: 'initializing' | 'ready' | 'incompatible' | 'disposed';
  reason?: string;
}

export interface LoroSelectionPoint {
  containerId: ContainerID;
  encodedCursor: Uint8Array;
  flowNodeId: string;
  side: -1 | 0 | 1;
}

export interface LoroSelectionSnapshot {
  anchor: LoroSelectionPoint;
  focus: LoroSelectionPoint;
  backward: boolean;
}

export interface LoroCommitOptions {
  message?: string;
  origin?: string;
}

/** A small map view used by the Properties collaboration port. */
export interface LoroAnnotationStorage {
  readonly map: LoroMap;
  readonly owner: object;
}
