// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { LoroDoc } from 'loro-crdt';

import type { CollaborationTransportPort } from '@/common/collaboration';
import type { AgentAwarenessState } from '@/plugins/yjs/protocol';
import { CollaborativeAgentEditor, hashRewriteText } from '../collaborative-agent-editor';
import { createLoroHeadlessFactory } from '../loro';
import {
  LoroCanonicalDocument,
  createLoroBindingDescriptor,
  getAttachedText,
} from '@/plugins/loro';

class ReadinessGateTransport implements CollaborationTransportPort {
  private readonly syncListeners = new Set<(synced: boolean) => void>();
  private resolveSync!: () => void;
  private readonly syncPromise = new Promise<void>((resolve) => {
    this.resolveSync = resolve;
  });
  readonly presence: unknown[] = [];

  connect(): void {}
  disconnect(): void {
    this.syncListeners.forEach((listener) => listener(false));
  }
  clearPresence(): void {
    this.presence.push(null);
  }
  setPresence(value: unknown): void {
    this.presence.push(value);
  }
  onStatus(): () => void {
    return () => undefined;
  }
  onSync(listener: (synced: boolean) => void): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }
  waitForPendingUpdates(): Promise<void> {
    return Promise.resolve();
  }
  waitForSync(): Promise<void> {
    return this.syncPromise;
  }
  release(): void {
    this.syncListeners.forEach((listener) => listener(true));
    this.resolveSync();
  }
}

describe('CollaborativeAgentEditor with the real Loro binding', () => {
  const sessions: CollaborativeAgentEditor[] = [];
  const docs: LoroDoc[] = [];

  afterEach(async () => {
    while (sessions.length > 0) await sessions.pop()!.disconnect();
    while (docs.length > 0) docs.pop()!.free();
  });

  it('runs the existing streaming rewrite flow through Loro anchors, readiness, and causal proof', async () => {
    const descriptor = createLoroBindingDescriptor();
    const doc = new LoroDoc();
    docs.push(doc);
    const canonical = new LoroCanonicalDocument(doc, descriptor);
    canonical.commit(
      () => {
        canonical.createNode({
          flow: 'hello',
          nodeId: 'paragraph-1',
          role: 'element',
          type: 'paragraph',
        });
      },
      { origin: 'loro:seed' },
    );

    const session = CollaborativeAgentEditor.create({
      descriptor,
      documentId: 'loro-agent-document',
      loro: { doc, factory: createLoroHeadlessFactory() },
      requestId: 'loro-agent-request',
      roomId: 'loro-agent-room',
      ticket: 'local-ticket',
    });
    sessions.push(session);
    await session.connect();

    expect(session.getStateVector()).toMatch(/[A-Za-z0-9+/]+=*/u);
    const engine = (session as unknown as { collaborationService: { getReadiness: () => string } })
      .collaborationService;
    expect(engine.getReadiness()).toBe('ready');

    const service = (
      session as unknown as {
        collaborationService: {
          capturePoint: (point: { nodeId: string; offset: number }) => unknown;
          descriptor: typeof descriptor;
          getVersionProof: () => unknown;
        };
      }
    ).collaborationService;
    const anchor = service.capturePoint({ nodeId: 'paragraph-1', offset: 0 });
    const focus = service.capturePoint({ nodeId: 'paragraph-1', offset: 5 });
    expect(anchor).toBeTruthy();
    expect(focus).toBeTruthy();
    const resolvedAnchor = session.resolveSelection({
      anchor: anchor as never,
      baseVersion: service.getVersionProof() as never,
      capturedAt: '2026-09-20T00:00:00.000Z',
      descriptor: service.descriptor,
      endNodeId: 'paragraph-1',
      focus: focus as never,
      kind: 'anchor',
      quotedText: 'hello',
      quotedTextHash: hashRewriteText('hello'),
      roomId: 'loro-agent-room',
      startNodeId: 'paragraph-1',
      targetNodeIds: ['paragraph-1'],
    });
    expect(resolvedAnchor?.quotedText).toBe('hello');

    const start = await session.startRewriteSession({
      expectedTextHash: hashRewriteText('hello'),
      generationId: 'loro-generation',
      requestId: 'loro-agent-request',
      sessionId: 'loro-session',
      selection: {
        endNodeId: 'paragraph-1',
        endOffset: 5,
        kind: 'block',
        quotedText: 'hello',
        startNodeId: 'paragraph-1',
        startOffset: 0,
        targetNodeIds: ['paragraph-1'],
      },
    });
    expect(start.status, start.error).toBe('streaming');

    const appended = await session.appendRewriteChunk({
      chunkId: 'loro-chunk-1',
      sessionId: 'loro-session',
      text: 'hello Loro',
    });
    expect(appended.status).toBe('streaming');

    const finalized = await session.finalizeRewriteSession({ sessionId: 'loro-session' });
    expect(finalized.status).toBe('applied');
    const node = canonical.findNodeById('paragraph-1');
    expect(node && getAttachedText(node, 'flow')?.toString()).toBe('hello Loro');
  });

  it('keeps Loro Agent display identity and anchors when awareness status changes', async () => {
    const descriptor = createLoroBindingDescriptor();
    const doc = new LoroDoc();
    docs.push(doc);
    const canonical = new LoroCanonicalDocument(doc, descriptor);
    canonical.commit(
      () => {
        canonical.createNode({
          flow: 'hello',
          nodeId: 'paragraph-awareness',
          role: 'element',
          type: 'paragraph',
        });
      },
      { origin: 'loro:seed' },
    );
    const transport = new ReadinessGateTransport();
    const session = CollaborativeAgentEditor.create({
      descriptor,
      documentId: 'loro-awareness-document',
      loro: { doc, factory: createLoroHeadlessFactory(), transport },
      requestId: 'loro-awareness-request',
      roomId: 'loro-awareness-room',
      ticket: 'local-ticket',
    });
    sessions.push(session);
    const connecting = session.connect();
    transport.release();
    await connecting;

    session.setAgentAwareness({
      caret: { nodeId: 'paragraph-awareness', offset: 2 },
      color: '#9333ea',
      documentId: 'loro-awareness-document',
      name: 'Rewrite Agent',
      requestId: 'loro-awareness-request',
      status: 'thinking',
    });

    const initial = transport.presence.at(-1) as {
      anchor: unknown;
      focus: unknown;
      state: Record<string, unknown>;
    };
    expect(initial.anchor).toBeTruthy();
    expect(initial.focus).toBeTruthy();
    expect(initial.state).toMatchObject({
      color: '#9333ea',
      name: 'Rewrite Agent',
      role: 'agent',
      status: 'thinking',
    });

    session.setAgentStatus('writing');
    const updated = transport.presence.at(-1) as typeof initial;
    expect(updated.anchor).toEqual(initial.anchor);
    expect(updated.focus).toEqual(initial.focus);
    expect(updated.state).toMatchObject({
      color: '#9333ea',
      name: 'Rewrite Agent',
      role: 'agent',
      status: 'writing',
    });

    session.setAgentAwareness({
      anchorPos: null,
      awarenessData: {
        documentId: 'loro-awareness-document',
        requestId: 'loro-awareness-request',
        role: 'agent',
        status: 'thinking',
      },
      caret: { nodeId: 'paragraph-awareness', offset: 3 },
      color: '#0f766e',
      focusPos: null,
      focusing: true,
      name: 'Full Agent',
    } satisfies AgentAwarenessState);
    const full = transport.presence.at(-1) as typeof initial;
    expect(full.anchor).toBeTruthy();
    expect(full.focus).toEqual(full.anchor);
    expect(full.state).toMatchObject({
      color: '#0f766e',
      focusing: true,
      name: 'Full Agent',
      role: 'agent',
      status: 'thinking',
    });

    session.clearAwareness();
    expect(transport.presence.at(-1)).toBeNull();
  });

  it('does not report Loro ready before transport sync releases the causal barrier', async () => {
    const descriptor = createLoroBindingDescriptor();
    const doc = new LoroDoc();
    docs.push(doc);
    const canonical = new LoroCanonicalDocument(doc, descriptor);
    canonical.commit(
      () => {
        canonical.createNode({
          flow: 'ready',
          nodeId: 'paragraph-ready',
          role: 'element',
          type: 'paragraph',
        });
      },
      { origin: 'loro:seed' },
    );
    const transport = new ReadinessGateTransport();
    const session = CollaborativeAgentEditor.create({
      descriptor,
      documentId: 'loro-ready-document',
      loro: { doc, factory: createLoroHeadlessFactory(), transport },
      requestId: 'loro-ready-request',
      roomId: 'loro-ready-room',
      ticket: 'local-ticket',
    });
    sessions.push(session);
    const connecting = session.connect();
    const service = (
      session as unknown as {
        collaborationService: { getReadiness: () => string };
      }
    ).collaborationService;
    expect(service.getReadiness()).toBe('initializing');
    transport.release();
    await connecting;
    expect(service.getReadiness()).toBe('ready');
  });
});
