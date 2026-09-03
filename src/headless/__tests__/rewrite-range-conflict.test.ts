// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  CollaborativeAgentEditor,
  hasOverlappingRewriteRanges,
  type AgentRewriteConflictRange,
} from '../collaborative-agent-editor';
import type { AgentRewriteRange } from '@/plugins/yjs/protocol';

const range = (
  targetNodeIds: string[],
  startNodeId: string,
  startOffset: number,
  endNodeId: string,
  endOffset: number,
): AgentRewriteConflictRange => ({
  endNodeId,
  endOffset,
  startNodeId,
  startOffset,
  targetNodeIds,
});

const checkRemoteAwarenessConflict = (
  local: AgentRewriteConflictRange,
  remoteAwarenessData: Record<string, unknown>,
): 'stream-session-busy' | 'stream-session-conflict' | null => {
  const localState = { awarenessData: {} };
  const host = {
    provider: {
      awareness: {
        getLocalState: () => localState,
        getStates: () =>
          new Map([
            [1, localState],
            [2, { awarenessData: remoteAwarenessData }],
          ]),
      },
    },
  };
  const probe = CollaborativeAgentEditor.prototype as unknown as {
    hasRemoteStreamingConflict: (
      selectionRange: AgentRewriteRange,
      targetNodeIds: ReadonlyArray<string>,
    ) => 'stream-session-busy' | 'stream-session-conflict' | null;
  };
  return probe.hasRemoteStreamingConflict.call(
    host as unknown as CollaborativeAgentEditor,
    local,
    local.targetNodeIds,
  );
};

describe('Agent rewrite range conflict detection', () => {
  it('allows disjoint selections in the same block', () => {
    expect(
      hasOverlappingRewriteRanges(
        range(['paragraph'], 'paragraph', 0, 'paragraph', 4),
        range(['paragraph'], 'paragraph', 4, 'paragraph', 9),
      ),
    ).toBe(false);
    expect(
      hasOverlappingRewriteRanges(
        range(['paragraph'], 'paragraph', 0, 'paragraph', 2),
        range(['paragraph'], 'paragraph', 5, 'paragraph', 9),
      ),
    ).toBe(false);
  });

  it('detects an actual overlap in the same block', () => {
    expect(
      hasOverlappingRewriteRanges(
        range(['paragraph'], 'paragraph', 2, 'paragraph', 6),
        range(['paragraph'], 'paragraph', 5, 'paragraph', 9),
      ),
    ).toBe(true);
  });

  it('compares the actual shared interval for cross-block ranges', () => {
    expect(
      hasOverlappingRewriteRanges(
        range(['first', 'second'], 'first', 2, 'second', 4),
        range(['second', 'third'], 'second', 3, 'third', 2),
      ),
    ).toBe(true);
    expect(
      hasOverlappingRewriteRanges(
        range(['first', 'second'], 'first', 2, 'second', 4),
        range(['second', 'third'], 'second', 4, 'third', 2),
      ),
    ).toBe(false);
  });

  it('does not conflict when the target projections are disjoint', () => {
    expect(
      hasOverlappingRewriteRanges(
        range(['first'], 'first', 0, 'first', 4),
        range(['second'], 'second', 0, 'second', 4),
      ),
    ).toBe(false);
  });

  it('signals callers to use the legacy block-id fallback for malformed ranges', () => {
    expect(
      hasOverlappingRewriteRanges(
        range(['first'], 'missing', 0, 'first', 4),
        range(['first'], 'first', 0, 'first', 4),
      ),
    ).toBeUndefined();
  });

  it('uses precise ranges when present and keeps the legacy block fallback safe', () => {
    const local = range(['paragraph'], 'paragraph', 0, 'paragraph', 4);
    expect(
      checkRemoteAwarenessConflict(local, {
        role: 'agent',
        sessionId: 'remote-session',
        status: 'writing',
        targetNodeIds: ['paragraph'],
        selectionRange: range(['paragraph'], 'paragraph', 4, 'paragraph', 8),
      }),
    ).toBe('stream-session-busy');
    expect(
      checkRemoteAwarenessConflict(local, {
        role: 'agent',
        sessionId: 'remote-session',
        status: 'writing',
        targetNodeIds: ['paragraph'],
        selectionRange: range(['paragraph'], 'paragraph', 3, 'paragraph', 8),
      }),
    ).toBe('stream-session-conflict');
    expect(
      checkRemoteAwarenessConflict(local, {
        role: 'agent',
        sessionId: 'legacy-session',
        status: 'writing',
        targetNodeIds: ['paragraph'],
      }),
    ).toBe('stream-session-busy');
    expect(
      checkRemoteAwarenessConflict(local, {
        role: 'agent',
        sessionId: 'legacy-other-block',
        status: 'writing',
        targetNodeIds: ['other-paragraph'],
      }),
    ).toBeNull();
  });
});
