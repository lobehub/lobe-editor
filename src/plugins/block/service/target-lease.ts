import { genServiceId } from '@/editor-kernel';
import type { IServiceID } from '@/types';

export const COLLABORATIVE_TARGET_LEASE_CAPABILITIES = [
  'select',
  'edit',
  'move',
  'delete',
] as const;

export type CollaborativeTargetLeaseCapability =
  (typeof COLLABORATIVE_TARGET_LEASE_CAPABILITIES)[number];
export type CollaborativeTargetKind = 'node' | 'subresource' | 'text-range';

export interface CollaborativeTargetLeaseTarget {
  documentId?: string;
  endNodeId?: string;
  endOffset?: number;
  nodeId?: string;
  startNodeId?: string;
  startOffset?: number;
  subresourceId?: string;
  targetKind: CollaborativeTargetKind;
  targetNodeIds?: readonly string[];
}

/** Boolean fields describe which operations this lease reserves from peers. */
export interface CollaborativeTargetLeaseCapabilities {
  delete: boolean;
  edit: boolean;
  move: boolean;
  select: boolean;
}

export interface CollaborativeTargetLease {
  capabilities: CollaborativeTargetLeaseCapabilities;
  /** Unix epoch milliseconds. */
  expiresAt: number;
  generation?: number | string;
  id: string;
  ownerId: string;
  ownerLabel?: string;
  requestId: string;
  sessionId?: string;
  target: CollaborativeTargetLeaseTarget;
}

export interface ICollaborativeTargetLeaseService {
  can: (
    target: CollaborativeTargetLeaseTarget,
    capability: CollaborativeTargetLeaseCapability,
    actorId?: string,
  ) => boolean;
  clearExpired: (now?: number) => void;
  getLease: (
    target: CollaborativeTargetLeaseTarget,
    now?: number,
  ) => CollaborativeTargetLease | null;
  getLeases: (now?: number) => CollaborativeTargetLease[];
  removeLease: (leaseId: string) => boolean;
  removeLeasesByRequest: (requestId: string) => number;
  replaceLeases: (leases: readonly CollaborativeTargetLease[]) => void;
  subscribe: (listener: () => void) => () => void;
  upsertLease: (lease: CollaborativeTargetLease) => boolean;
}

export const ICollaborativeTargetLeaseService: IServiceID<ICollaborativeTargetLeaseService> =
  genServiceId('CollaborativeTargetLeaseService');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isCapability = (value: unknown): value is CollaborativeTargetLeaseCapability =>
  (COLLABORATIVE_TARGET_LEASE_CAPABILITIES as readonly string[]).includes(value as string);

const normalizeExpiry = (value: Date | number | string): number | null => {
  const timestamp =
    value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? Math.trunc(timestamp) : null;
};

const normalizeTarget = (
  target: CollaborativeTargetLeaseTarget,
): CollaborativeTargetLeaseTarget | null => {
  if (!isRecord(target)) return null;
  const targetKind = target.targetKind;
  if (targetKind !== 'node' && targetKind !== 'subresource' && targetKind !== 'text-range') {
    return null;
  }
  const normalized: CollaborativeTargetLeaseTarget = {
    ...(isNonEmptyString(target.documentId) ? { documentId: target.documentId.trim() } : {}),
    targetKind,
  };
  if (isNonEmptyString(target.nodeId)) normalized.nodeId = target.nodeId.trim();
  if (isNonEmptyString(target.subresourceId))
    normalized.subresourceId = target.subresourceId.trim();
  if (isNonEmptyString(target.startNodeId)) normalized.startNodeId = target.startNodeId.trim();
  if (isNonEmptyString(target.endNodeId)) normalized.endNodeId = target.endNodeId.trim();
  for (const key of ['startOffset', 'endOffset'] as const) {
    const offset = target[key];
    if (offset !== undefined) {
      if (!Number.isSafeInteger(offset) || offset < 0) return null;
      normalized[key] = offset;
    }
  }
  if (target.targetNodeIds !== undefined) {
    if (
      !Array.isArray(target.targetNodeIds) ||
      target.targetNodeIds.length === 0 ||
      target.targetNodeIds.some((nodeId) => !isNonEmptyString(nodeId))
    ) {
      return null;
    }
    normalized.targetNodeIds = [...new Set(target.targetNodeIds.map((nodeId) => nodeId.trim()))];
  }

  if (targetKind === 'node' && !normalized.nodeId) return null;
  if (targetKind === 'subresource' && (!normalized.nodeId || !normalized.subresourceId))
    return null;
  if (
    targetKind === 'text-range' &&
    !normalized.targetNodeIds?.length &&
    (!normalized.startNodeId || !normalized.endNodeId)
  ) {
    return null;
  }
  return normalized;
};

const normalizeCapabilities = (
  capabilities: CollaborativeTargetLeaseCapabilities,
): CollaborativeTargetLeaseCapabilities | null => {
  if (!isRecord(capabilities)) return null;
  const normalized = {} as CollaborativeTargetLeaseCapabilities;
  for (const capability of COLLABORATIVE_TARGET_LEASE_CAPABILITIES) {
    if (typeof capabilities[capability] !== 'boolean') return null;
    normalized[capability] = capabilities[capability];
  }
  return normalized;
};

const normalizeLease = (lease: CollaborativeTargetLease): CollaborativeTargetLease | null => {
  if (
    !isRecord(lease) ||
    !isNonEmptyString(lease.id) ||
    !isNonEmptyString(lease.ownerId) ||
    !isNonEmptyString(lease.requestId)
  ) {
    return null;
  }
  const target = normalizeTarget(lease.target);
  const capabilities = normalizeCapabilities(lease.capabilities);
  const expiresAt = normalizeExpiry(lease.expiresAt);
  if (!target || !capabilities || expiresAt === null) return null;
  return {
    capabilities,
    expiresAt,
    ...(typeof lease.generation === 'number' || typeof lease.generation === 'string'
      ? { generation: lease.generation }
      : {}),
    id: lease.id.trim(),
    ownerId: lease.ownerId.trim(),
    ...(isNonEmptyString(lease.ownerLabel) ? { ownerLabel: lease.ownerLabel.trim() } : {}),
    requestId: lease.requestId.trim(),
    ...(isNonEmptyString(lease.sessionId) ? { sessionId: lease.sessionId.trim() } : {}),
    target,
  };
};

const targetNodeIds = (target: CollaborativeTargetLeaseTarget): string[] => [
  ...(target.nodeId ? [target.nodeId] : []),
  ...(target.targetNodeIds ?? []),
  ...(target.startNodeId ? [target.startNodeId] : []),
  ...(target.endNodeId ? [target.endNodeId] : []),
];

const rangeForNode = (
  target: CollaborativeTargetLeaseTarget,
  nodeId: string,
): { end: number; start: number } => {
  if (target.targetKind === 'node' || target.targetKind === 'subresource') {
    return { end: Number.POSITIVE_INFINITY, start: 0 };
  }
  if (target.startNodeId === target.endNodeId && target.startNodeId === nodeId) {
    const start = target.startOffset ?? 0;
    const end = target.endOffset ?? Number.POSITIVE_INFINITY;
    return start <= end ? { end, start } : { end: start, start: end };
  }
  return { end: Number.POSITIVE_INFINITY, start: 0 };
};

const rangesOverlap = (
  left: { end: number; start: number },
  right: { end: number; start: number },
): boolean => left.start < right.end && right.start < left.end;

const targetsOverlap = (
  left: CollaborativeTargetLeaseTarget,
  right: CollaborativeTargetLeaseTarget,
): boolean => {
  if (left.documentId && right.documentId && left.documentId !== right.documentId) return false;

  const leftNode = left.nodeId;
  const rightNode = right.nodeId;
  // A node lease reserves the entire node, including any declared
  // subresource. This is the policy used by card/code editors.
  if (leftNode && rightNode && leftNode === rightNode) {
    if (left.targetKind !== 'text-range' || right.targetKind !== 'text-range') return true;
    return rangesOverlap(rangeForNode(left, leftNode), rangeForNode(right, rightNode));
  }

  const leftIds = new Set(targetNodeIds(left));
  const commonNodeIds = targetNodeIds(right).filter((nodeId) => leftIds.has(nodeId));
  if (commonNodeIds.length === 0) return false;
  if (left.targetKind !== 'text-range' || right.targetKind !== 'text-range') return true;
  return commonNodeIds.some((nodeId) =>
    rangesOverlap(rangeForNode(left, nodeId), rangeForNode(right, nodeId)),
  );
};

const isSameOwner = (lease: CollaborativeTargetLease, actorId?: string): boolean =>
  Boolean(
    actorId &&
    [lease.ownerId, lease.requestId, lease.sessionId].some(
      (identity) => identity !== undefined && identity === actorId,
    ),
  );

const generationIsOlder = (
  candidate: number | string | undefined,
  current: number | string | undefined,
): boolean => {
  if (candidate === undefined || current === undefined || typeof candidate !== typeof current) {
    return false;
  }
  if (typeof candidate === 'number' && typeof current === 'number') return candidate < current;
  return typeof candidate === 'string' && typeof current === 'string' && candidate < current;
};

/**
 * In-memory, editor-scoped lease policy. The server remains authoritative for
 * durable overlap/ownership; this service is the browser's fail-closed gate
 * for selection and mutation affordances while those leases are active.
 */
export class CollaborativeTargetLeaseService implements ICollaborativeTargetLeaseService {
  private leases = new Map<string, CollaborativeTargetLease>();
  private listeners = new Set<() => void>();

  can = (
    target: CollaborativeTargetLeaseTarget,
    capability: CollaborativeTargetLeaseCapability,
    actorId?: string,
  ): boolean => {
    if (!isCapability(capability)) return false;
    const normalizedTarget = normalizeTarget(target);
    if (!normalizedTarget) return false;
    const now = Date.now();
    for (const lease of this.leases.values()) {
      if (lease.expiresAt <= now || !targetsOverlap(normalizedTarget, lease.target)) continue;
      if (!lease.capabilities[capability] || isSameOwner(lease, actorId)) continue;
      return false;
    }
    return true;
  };

  clearExpired = (now = Date.now()): void => {
    let changed = false;
    for (const [id, lease] of this.leases) {
      if (lease.expiresAt <= now) {
        this.leases.delete(id);
        changed = true;
      }
    }
    if (changed) this.notify();
  };

  getLease = (
    target: CollaborativeTargetLeaseTarget,
    now = Date.now(),
  ): CollaborativeTargetLease | null => {
    const normalizedTarget = normalizeTarget(target);
    if (!normalizedTarget) return null;
    for (const lease of this.leases.values()) {
      if (lease.expiresAt > now && targetsOverlap(normalizedTarget, lease.target)) return lease;
    }
    return null;
  };

  getLeases = (now = Date.now()): CollaborativeTargetLease[] =>
    [...this.leases.values()].filter((lease) => lease.expiresAt > now);

  removeLease = (leaseId: string): boolean => {
    const removed = this.leases.delete(leaseId);
    if (removed) this.notify();
    return removed;
  };

  removeLeasesByRequest = (requestId: string): number => {
    if (!isNonEmptyString(requestId)) return 0;
    let removed = 0;
    for (const [id, lease] of this.leases) {
      if (lease.requestId === requestId) {
        this.leases.delete(id);
        removed += 1;
      }
    }
    if (removed > 0) this.notify();
    return removed;
  };

  replaceLeases = (leases: readonly CollaborativeTargetLease[]): void => {
    const next = new Map<string, CollaborativeTargetLease>();
    for (const lease of leases) {
      const normalized = normalizeLease(lease);
      if (!normalized || normalized.expiresAt <= Date.now()) continue;
      next.set(normalized.id, normalized);
    }
    const changed =
      next.size !== this.leases.size ||
      [...next].some(
        ([id, lease]) => JSON.stringify(lease) !== JSON.stringify(this.leases.get(id)),
      );
    if (!changed) return;
    this.leases = next;
    this.notify();
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    listener();
    return () => this.listeners.delete(listener);
  };

  upsertLease = (lease: CollaborativeTargetLease): boolean => {
    const normalized = normalizeLease(lease);
    if (!normalized) return false;
    const current = this.leases.get(normalized.id);
    if (current && generationIsOlder(normalized.generation, current.generation)) return false;
    if (current && JSON.stringify(current) === JSON.stringify(normalized)) return false;
    this.leases.set(normalized.id, normalized);
    this.notify();
    return true;
  };

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}
