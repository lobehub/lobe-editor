import { Doc } from 'yjs';

import {
  decodeYjsBase64,
  encodeYjsBase64,
  LOBE_YJS_PROTOCOL,
  LOBE_YJS_PROTOCOL_VERSION,
  parseLobeYjsMessage,
} from '../protocol';

describe('lobe-yjs-v1 protocol', () => {
  it('round-trips Yjs bytes without relying on window globals', () => {
    const doc = new Doc();
    const state = doc.getMap('state');
    state.set('text', 'node-safe');

    const encoded = encodeYjsBase64(new Uint8Array([0, 1, 2, 127, 128, 255]));
    expect(Array.from(decodeYjsBase64(encoded))).toEqual([0, 1, 2, 127, 128, 255]);
    doc.destroy();
  });

  it('validates the v1 message envelope and rejects unsupported versions', () => {
    expect(
      parseLobeYjsMessage({
        nonce: 'nonce',
        protocol: LOBE_YJS_PROTOCOL,
        roomId: 'room-a',
        type: 'hello',
        version: LOBE_YJS_PROTOCOL_VERSION,
      }),
    ).toMatchObject({ type: 'hello' });

    expect(
      parseLobeYjsMessage({
        nonce: 'nonce',
        protocol: LOBE_YJS_PROTOCOL,
        roomId: 'room-a',
        type: 'hello',
        version: 2,
      }),
    ).toBeNull();
    expect(parseLobeYjsMessage({ type: 'update', update: 'not-v1' })).toBeNull();
  });
});
