/// <reference types="vitest" />

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Doc, XmlElement, XmlText, applyUpdate, encodeStateAsUpdate } from 'yjs';

import { BusinessCollaborationProvider } from './BusinessCollaborationProvider';
import { base64ToBytes, bytesToBase64 } from './codec';

class FakeEventSource {
  private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  close() {}
}

const createParagraphElement = (text: string) => {
  const paragraph = new XmlElement('p');
  paragraph.insert(0, [new XmlText(text)]);

  return paragraph;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('BusinessCollaborationProvider', () => {
  it('publishes local Yjs state after reconnecting with offline edits', async () => {
    const serverDoc = new Doc();
    serverDoc.get('root-v2', XmlElement).insert(0, [createParagraphElement('server')]);

    let snapshotUpdate: null | string = bytesToBase64(encodeStateAsUpdate(serverDoc));
    const postedUpdates: string[] = [];

    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.includes('/snapshot')) {
          return Response.json({
            awareness: [],
            hasContent: Boolean(snapshotUpdate),
            update: snapshotUpdate,
          });
        }

        if (url.includes('/update')) {
          const payload = JSON.parse(init?.body as string) as { update: string };
          postedUpdates.push(payload.update);
          applyUpdate(serverDoc, base64ToBytes(payload.update));
          snapshotUpdate = bytesToBase64(encodeStateAsUpdate(serverDoc));

          return Response.json({ ok: true });
        }

        if (url.includes('/awareness')) {
          return Response.json({ ok: true });
        }

        return new Response(null, { status: 404 });
      }),
    );

    const localDoc = new Doc();
    const provider = new BusinessCollaborationProvider('room-1', localDoc);

    await provider.connect();
    expect(postedUpdates).toHaveLength(0);

    provider.disconnect();
    localDoc.get('root-v2', XmlElement).insert(1, [createParagraphElement('offline')]);

    await provider.connect();

    expect(postedUpdates).toHaveLength(1);
    expect(serverDoc.get('root-v2', XmlElement).toString()).toContain('offline');
  });
});
