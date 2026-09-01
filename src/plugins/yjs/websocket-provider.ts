import type { Provider, UserState } from '@lexical/yjs';
import { Doc } from 'yjs';

import type { WebSocketYjsProviderOptions } from './websocket-provider-core';
import { WebSocketYjsProviderCore } from './websocket-provider-core';

const DEFAULT_HTTP_BASE_URL = 'http://localhost:12345';
const DEFAULT_WS_BASE_URL = 'ws://localhost:12345';

export type { WebSocketConstructor, WebSocketYjsProviderStatus } from './websocket-provider-core';
export type {
  WebSocketLike,
  WebSocketMessageEvent,
  WebSocketYjsProviderOptions,
} from './websocket-provider-core';
export { WebSocketAwareness, WebSocketYjsProviderCore } from './websocket-provider-core';

/**
 * Browser provider kept as a compatibility facade for the existing Page demo.
 * New callers can opt into `lobe-yjs-v1` with `legacyProtocol: false`; the
 * default remains legacy until every deployed Page room server has upgraded.
 */
export class WebSocketYjsProvider extends WebSocketYjsProviderCore {
  constructor(
    id: string,
    doc: Doc,
    optionsOrWsBaseUrl: CreateWebSocketYjsProviderOptions | string = DEFAULT_WS_BASE_URL,
  ) {
    const options =
      typeof optionsOrWsBaseUrl === 'string'
        ? { wsBaseUrl: optionsOrWsBaseUrl }
        : optionsOrWsBaseUrl;

    super(id, doc, {
      ...options,
      clientKind: 'browser',
      legacyProtocol: options.legacyProtocol ?? true,
      wsBaseUrl: options.wsBaseUrl ?? DEFAULT_WS_BASE_URL,
    });
  }
}

export interface CreateWebSocketYjsProviderOptions extends Omit<
  WebSocketYjsProviderOptions,
  'clientKind' | 'legacyProtocol'
> {
  /** Set false to use the authenticated lobe-yjs-v1 wire protocol. */
  legacyProtocol?: boolean;
}

export function createWebSocketYjsProvider(
  id: string,
  yjsDocMap: Map<string, Doc>,
  options: CreateWebSocketYjsProviderOptions = {},
): WebSocketYjsProvider {
  const doc = yjsDocMap.get(id) || new Doc();
  yjsDocMap.set(id, doc);

  return new WebSocketYjsProvider(id, doc, options);
}

/**
 * Type-only compatibility helper for consumers that import UserState from the
 * provider module while migrating to the shared protocol module.
 */
export type { Provider, UserState };

export async function fetchWebSocketDemoDocument(id: string): Promise<unknown> {
  const response = await fetch(`${DEFAULT_HTTP_BASE_URL}/documents/${encodeURIComponent(id)}`);

  if (!response.ok) {
    throw new Error(`Failed to load document: ${response.status}`);
  }

  const { content } = (await response.json()) as { content: unknown };
  return content;
}

async function postWebSocketDemoDocument(
  id: string,
  path: 'save' | 'snapshot',
  content: unknown,
): Promise<void> {
  const response = await fetch(
    `${DEFAULT_HTTP_BASE_URL}/documents/${encodeURIComponent(id)}/${path}`,
    {
      body: JSON.stringify({ content }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to ${path} document: ${response.status}`);
  }
}

export async function saveWebSocketDemoDocument(id: string, content: unknown): Promise<void> {
  await postWebSocketDemoDocument(id, 'save', content);
}

export function snapshotWebSocketDemoDocument(id: string, content: unknown): void {
  const url = `${DEFAULT_HTTP_BASE_URL}/documents/${encodeURIComponent(id)}/snapshot`;
  const body = JSON.stringify({ content });

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });

    if (navigator.sendBeacon(url, blob)) return;
  }

  void fetch(url, {
    body,
    headers: {
      'Content-Type': 'application/json',
    },
    keepalive: true,
    method: 'POST',
  }).catch(() => {});
}
