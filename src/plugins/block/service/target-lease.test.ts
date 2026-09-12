import { describe, expect, it, vi } from 'vitest';

import { CollaborativeTargetLeaseService } from './target-lease';

const capabilities = { delete: true, edit: true, move: true, select: true } as const;

const lease = (overrides: Record<string, unknown> = {}) =>
  ({
    capabilities,
    expiresAt: Date.now() + 60_000,
    generation: 2,
    id: 'lease-1',
    ownerId: 'agent-1',
    requestId: 'request-1',
    sessionId: 'session-1',
    target: { nodeId: 'node-1', targetKind: 'node' as const },
    ...overrides,
  }) as never;

describe('CollaborativeTargetLeaseService', () => {
  it('fails closed for unknown targets/capabilities and blocks peers on an active node', () => {
    const service = new CollaborativeTargetLeaseService();

    expect(service.can({ targetKind: 'node' } as never, 'edit')).toBe(false);
    expect(service.can({ nodeId: 'node-1', targetKind: 'node' }, 'copy' as never)).toBe(false);
    expect(service.upsertLease(lease())).toBe(true);
    expect(service.can({ nodeId: 'node-1', targetKind: 'node' }, 'edit')).toBe(false);
    expect(service.can({ nodeId: 'node-1', targetKind: 'node' }, 'edit', 'agent-1')).toBe(true);
    expect(service.can({ nodeId: 'node-2', targetKind: 'node' }, 'edit')).toBe(true);
  });

  it('treats node leases as whole-node locks and text ranges as half-open', () => {
    const service = new CollaborativeTargetLeaseService();
    service.upsertLease(
      lease({
        id: 'text',
        target: {
          endNodeId: 'node-1',
          endOffset: 5,
          startNodeId: 'node-1',
          startOffset: 0,
          targetKind: 'text-range',
          targetNodeIds: ['node-1'],
        },
      }),
    );

    expect(service.can({ nodeId: 'node-1', targetKind: 'node' }, 'select')).toBe(false);
    expect(
      service.can(
        {
          endNodeId: 'node-1',
          endOffset: 10,
          startNodeId: 'node-1',
          startOffset: 5,
          targetKind: 'text-range',
          targetNodeIds: ['node-1'],
        },
        'edit',
      ),
    ).toBe(true);
  });

  it('ignores stale generations, expires leases, and notifies lifecycle consumers', () => {
    const service = new CollaborativeTargetLeaseService();
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(service.upsertLease(lease({ generation: 3 }))).toBe(true);
    expect(service.upsertLease(lease({ generation: 2 }))).toBe(false);
    expect(service.can({ nodeId: 'node-1', targetKind: 'node' }, 'delete')).toBe(false);

    service.clearExpired(Date.now() + 120_000);
    expect(service.getLeases(Date.now() + 120_000)).toEqual([]);
    expect(service.can({ nodeId: 'node-1', targetKind: 'node' }, 'delete')).toBe(true);
    unsubscribe();
  });
});
