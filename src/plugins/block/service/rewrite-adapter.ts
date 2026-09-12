import type { LexicalNode } from 'lexical';

import { genServiceId } from '@/editor-kernel';
import { $isHoleNode, $resolveLogicalBlockNode } from '@/plugins/common/node/hole';
import type { IEditorKernel, IServiceID } from '@/types';

export const BLOCK_REWRITE_MAX_SOURCE_LENGTH = 1_048_576;
export const BLOCK_REWRITE_MAX_TITLE_LENGTH = 255;
export const BLOCK_REWRITE_MAX_LANGUAGE_LENGTH = 64;

/** Metadata attached to one atomic, adapter-owned block mutation. */
export interface BlockRewriteApplyMetadata {
  adapterKey: string;
  commandId?: string;
  createdAt?: string;
  generationId?: string;
  model?: string;
  provenanceSessionId?: string;
  provider?: string;
  requestId?: string;
  turnIndex?: number;
}

/** Bounded data shown to a model/UI before an adapter applies a rewrite. */
export interface BlockRewriteContext {
  adapterKey: string;
  capabilities: BlockRewriteCapabilities;
  /** Canonical adapter language for source-backed code blocks. */
  language?: string;
  /** Accepted aliases for the canonical language, used by worker proofing. */
  languageAliases?: readonly string[];
  nodeId: string;
  nodeType: string;
  sourceHash?: string;
  source?: string;
  summary?: string;
  title?: string;
  image?: BlockRewriteImageContext;
}

export interface BlockRewriteImageContext {
  altText: string;
  height: number | null;
  maxWidth: number;
  placeholder: boolean;
  src: string;
  status: 'uploaded' | 'loading' | 'error';
  width: number | null;
}

export interface BlockRewriteCapabilities {
  canEdit: boolean;
  canMove: boolean;
  canSelect: boolean;
}

export type BlockRewriteOutputSchema = 'patch' | 'source';

export interface BlockRewriteSourceOutput {
  kind: 'source';
  /** Optional canonicalizable language change for code adapters. */
  language?: string;
  source: string;
  title?: string;
}

export interface BlockRewritePatchOutput {
  kind: 'patch';
  patch: Record<string, unknown>;
}

export type BlockRewriteOutput = BlockRewritePatchOutput | BlockRewriteSourceOutput;

export const isBlockRewriteSourceOutput = (value: unknown): value is BlockRewriteSourceOutput => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const output = value as Record<string, unknown>;
  return (
    output.kind === 'source' &&
    typeof output.source === 'string' &&
    output.source.length <= BLOCK_REWRITE_MAX_SOURCE_LENGTH &&
    (output.language === undefined ||
      (typeof output.language === 'string' &&
        output.language.trim().length > 0 &&
        output.language.length <= BLOCK_REWRITE_MAX_LANGUAGE_LENGTH)) &&
    (output.title === undefined ||
      (typeof output.title === 'string' &&
        output.title.trim().length > 0 &&
        output.title.length <= BLOCK_REWRITE_MAX_TITLE_LENGTH))
  );
};

export const isBlockRewritePatchOutput = (value: unknown): value is BlockRewritePatchOutput => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const output = value as Record<string, unknown>;
  if (output.kind !== 'patch' || !output.patch || typeof output.patch !== 'object') return false;
  try {
    return JSON.stringify(output.patch).length <= BLOCK_REWRITE_MAX_SOURCE_LENGTH;
  } catch {
    return false;
  }
};

export type BlockRewriteValidationResult =
  | {
      ok: true;
      output: unknown;
    }
  | {
      code: string;
      message: string;
      ok: false;
    };

/**
 * Editor-owned adapter for an atomic/card-like block. The Page host only
 * discovers/captures these descriptors; validation and mutation remain with
 * the plugin that owns the node.
 */
export interface BlockRewriteAdapter {
  apply: (node: LexicalNode, output: unknown, metadata: BlockRewriteApplyMetadata) => void;
  capabilities: BlockRewriteCapabilities;
  key: string;
  outputSchema: BlockRewriteOutputSchema;
  readContext: (node: LexicalNode) => BlockRewriteContext | null;
  supports: (node: LexicalNode) => boolean;
  validate: (node: LexicalNode, output: unknown) => BlockRewriteValidationResult;
}

export interface BlockRewriteAdapterService {
  getAdapter: (node: LexicalNode) => BlockRewriteAdapter | null;
  getAdapterByKey: (key: string) => BlockRewriteAdapter | null;
  registerAdapter: (adapter: BlockRewriteAdapter) => () => void;
}

export interface ResolvedRewriteAdapterTarget {
  adapter: BlockRewriteAdapter;
  context: BlockRewriteContext;
  node: LexicalNode;
}

export const IBlockRewriteAdapterService: IServiceID<BlockRewriteAdapterService> = genServiceId(
  'BlockRewriteAdapterService',
);

export class BlockRewriteAdapterRegistry implements BlockRewriteAdapterService {
  private adapters = new Map<string, BlockRewriteAdapter>();

  getAdapter = (node: LexicalNode): BlockRewriteAdapter | null => {
    for (const adapter of this.adapters.values()) {
      try {
        if (adapter.supports(node)) return adapter;
      } catch {
        // A third-party adapter must not break the block menu for other nodes.
      }
    }
    return null;
  };

  getAdapterByKey = (key: string): BlockRewriteAdapter | null =>
    this.adapters.get(key.trim()) ?? null;

  registerAdapter = (adapter: BlockRewriteAdapter): (() => void) => {
    if (!adapter.key.trim()) throw new Error('BlockRewriteAdapter.key is required');
    const previous = this.adapters.get(adapter.key);
    this.adapters.set(adapter.key, adapter);
    return () => {
      if (this.adapters.get(adapter.key) === adapter) {
        if (previous) this.adapters.set(adapter.key, previous);
        else this.adapters.delete(adapter.key);
      }
    };
  };
}

/**
 * Resolve the durable business node represented by a block-menu host.
 *
 * The block controller may expose either a logical node or a structural Hole
 * as its menu id. Only the explicit Hole contract is allowed to unwrap a
 * descendant: exactly one non-cursor content child must exist. This keeps a
 * future composite/card wrapper from accidentally selecting an arbitrary
 * nested code, link, or artifact node.
 */
export const resolveRewriteAdapterTarget = (
  hostNode: LexicalNode | null | undefined,
  service: BlockRewriteAdapterService | null | undefined,
): ResolvedRewriteAdapterTarget | null => {
  if (!hostNode || !service) return null;

  const candidates: LexicalNode[] = [];
  const addCandidate = (node: LexicalNode | null | undefined): void => {
    if (node && !candidates.includes(node)) candidates.push(node);
  };

  addCandidate(hostNode);
  if (!$isHoleNode(hostNode)) {
    addCandidate($resolveLogicalBlockNode(hostNode));
  } else {
    const contentChildren = hostNode.getContentChildren();
    // A Hole with multiple content children is a structural container, not a
    // single adapter-owned target. Do not guess which descendant the user
    // meant. The one-child case covers Artifact, CodeMirror, codeblock, and
    // LinkBlock cards wrapped by the existing Hole contract.
    if (contentChildren.length === 1) addCandidate(contentChildren[0]);
  }

  for (const node of candidates) {
    let adapter: BlockRewriteAdapter | null = null;
    try {
      adapter = service.getAdapter(node);
    } catch {
      adapter = null;
    }
    if (!adapter) continue;

    try {
      const context = adapter.readContext(node);
      if (!context || !context.nodeId) continue;
      return { adapter, context, node };
    } catch {
      // A stale/deleted node must simply disappear from the menu. The host
      // should remain eligible for the normal text-block fallback when one
      // exists, so continue checking the remaining explicit candidates.
    }
  }

  return null;
};

/** Register an adapter even when the host did not mount BlockPlugin yet. */
export const registerBlockRewriteAdapter = (
  kernel: IEditorKernel,
  adapter: BlockRewriteAdapter,
): (() => void) => {
  let service = kernel.requireService(IBlockRewriteAdapterService);
  if (!service) {
    service = new BlockRewriteAdapterRegistry();
    kernel.registerServiceHotReload(IBlockRewriteAdapterService, service);
  }
  return service.registerAdapter(adapter);
};
