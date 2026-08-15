# Yjs WebSocket Demo Server

This document describes how to run `yjs-websocket-demo-server.cjs`, how the demo
is designed, and what an AI assistant should preserve when changing it.

## What It Is For

This server is a local demo for the "JSON persistence + runtime collaboration"
migration path.

The production-like model it simulates is:

1. The server stores Lexical JSON as the durable document format.
2. A browser opens a document and loads the JSON through HTTP.
3. During editing, clients collaborate through a room-scoped `Y.Doc` over
   WebSocket.
4. A user can explicitly save JSON back to the server.
5. A client can also submit a best-effort snapshot before unload so an idle room
   can be evicted without immediately losing the latest browser-side JSON.

The important boundary is that WebSocket messages do not sync JSON patches.
WebSocket only carries Yjs runtime updates and awareness.

## Run It

Start the WebSocket demo server:

```bash
npm run demo:yjs-server
```

Start the docs/dev server in another terminal:

```bash
pnpm docs:dev --host 127.0.0.1
```

Open the WebSocket JSON demo directly:

```text
http://localhost:8000/?yjsMode=websocket
```

Open the same URL in two Chrome windows, two browsers, or a normal window plus
an incognito window to verify collaboration.

## HTTP API

Default port: `12345`.

### `GET /documents/:id`

Returns the current persisted Lexical JSON envelope:

```json
{
  "content": {},
  "id": "editor-demo",
  "savedAt": "2026-06-14T00:00:00.000Z",
  "source": "seed",
  "version": 1
}
```

`content` is the Lexical JSON used by the browser as the initial document.

### `POST /documents/:id/save`

Persists an explicit user save.

Request body:

```json
{
  "content": {}
}
```

The saved metadata uses:

```text
source: "explicit-save"
```

This endpoint matches the current production-style model where the client sends
JSON to the server at save time.

### `POST /documents/:id/snapshot`

Persists a best-effort client snapshot, usually from `beforeunload`.

Request body:

```json
{
  "content": {}
}
```

The saved metadata uses:

```text
source: "snapshot"
```

This exists because idle rooms can be evicted. Without a snapshot or explicit
save, unsaved runtime Yjs state may be lost after eviction.

### `GET /rooms`

Returns demo diagnostics:

```json
{
  "activeRooms": 1,
  "idleRooms": 0,
  "memory": {},
  "rooms": [
    {
      "id": "editor-demo",
      "clientCount": 2,
      "awarenessCount": 2,
      "status": "active",
      "lastActiveAt": "2026-06-14T00:00:00.000Z",
      "lastEmptyAt": null
    }
  ],
  "totalRooms": 1
}
```

Use this while testing connection count, awareness cleanup, and idle room
eviction.

## WebSocket API

Connect to:

```text
ws://localhost:12345/collaboration/:id?clientId=:clientId
```

The browser provider sends its Yjs `clientID` as `clientId`.

### Initial Server Message

On connection, the server immediately sends:

```json
{
  "awareness": [
    {
      "clientId": 123,
      "state": {}
    }
  ],
  "type": "sync",
  "update": "base64-yjs-update"
}
```

The `update` field is `encodeStateAsUpdate(room.doc)` encoded as base64.

### Client Update Message

Client to server:

```json
{
  "type": "update",
  "update": "base64-yjs-update"
}
```

The server applies the update to the room `Y.Doc`, then broadcasts the same
message to every other connected client in that room.

### Awareness Message

Client to server and server to peers:

```json
{
  "sender": 123,
  "state": {},
  "type": "awareness"
}
```

When `state` is `null`, the peer's awareness state should be removed.

## Room Lifecycle

The server keeps two in-memory maps:

```text
documents: Map<string, LexicalJson>
rooms: Map<string, { doc: Y.Doc, clients: Set<WebSocket>, awareness: Map }>
```

`documents` is durable only for this local process. It simulates the backend's
JSON storage.

`rooms` is runtime state. A room owns the active collaborative `Y.Doc` while
clients are editing.

When the last client leaves:

1. The room becomes idle.
2. Awareness is cleared.
3. The room's `Y.Doc` is kept in memory for a while.
4. Cleanup may evict the room later.

An idle room can be evicted when any of these conditions is met:

- idle TTL expires,
- the number of idle rooms exceeds the configured limit,
- Node.js heap pressure crosses the configured threshold.

Eviction destroys the runtime `Y.Doc`. Persisted JSON is not removed.

## Environment Variables

| Name                                    |     Default | Purpose                                                  |
| --------------------------------------- | ----------: | -------------------------------------------------------- |
| `YJS_DEMO_PORT`                         |     `12345` | HTTP and WebSocket port.                                 |
| `YJS_DEMO_MAX_HTTP_BODY_BYTES`          |   `2097152` | Max JSON body size for save/snapshot requests.           |
| `YJS_DEMO_MAX_WS_MESSAGE_BYTES`         |   `2097152` | Max WebSocket message size.                              |
| `YJS_DEMO_ROOM_IDLE_TTL_MS`             |   `1800000` | How long an empty room can stay in memory.               |
| `YJS_DEMO_ROOM_CLEANUP_INTERVAL_MS`     |     `60000` | Idle-room cleanup interval.                              |
| `YJS_DEMO_HEARTBEAT_INTERVAL_MS`        |     `30000` | WebSocket ping interval.                                 |
| `YJS_DEMO_MAX_IDLE_ROOMS`               |        `20` | Max idle rooms before oldest idle rooms are evicted.     |
| `YJS_DEMO_ROOM_HEAP_PRESSURE_MIN_BYTES` | `268435456` | Minimum heap used before heap-ratio eviction can run.    |
| `YJS_DEMO_ROOM_HEAP_PRESSURE_RATIO`     |       `0.8` | Heap used / heap total threshold for idle room eviction. |

Example:

```bash
YJS_DEMO_PORT=12346 YJS_DEMO_ROOM_IDLE_TTL_MS=60000 npm run demo:yjs-server
```

## Design Notes

### JSON Is Storage, Y.Doc Is Runtime

Do not redesign this demo as JSON patch collaboration. The intended production
path is to keep the existing JSON load/save contract and add Yjs as the runtime
collaboration layer.

### Save Boundary

`/save` persists JSON from the client. This mirrors the existing single-user
save model.

This demo does not convert server-side `Y.Doc` back into Lexical JSON. If a
future version needs server-side export, add it explicitly and rename the
endpoint or behavior so the boundary is clear.

### Snapshot Boundary

`/snapshot` is a best-effort safety net for room eviction and page unload. It is
not an autosave product feature and should not be treated as a conflict-audited
backend save.

### Reconnect Boundary

The browser provider reconnects with exponential backoff. After reconnecting it
sends the local `Y.Doc` state back to the server so local edits made while
offline can merge into the room.

### Deployment Boundary

This server is a local demo script, not a production WebSocket service.

Serverless platforms that do not support long-lived WebSocket connections, such
as ordinary Vercel serverless functions, should not host this process directly.
Use a separate WebSocket-capable runtime for production, then keep the JSON
storage API behind the existing backend boundary.

## Manual Test Checklist

1. Start `npm run demo:yjs-server`.
2. Start `pnpm docs:dev --host 127.0.0.1`.
3. Open `http://localhost:8000/?yjsMode=websocket` in two browser contexts.
4. Confirm both pages show `connected`.
5. Call `curl -s http://localhost:12345/rooms` and confirm:
   - `clientCount` is `2`,
   - `awarenessCount` is `2`.
6. Type in client A and verify client B updates.
7. Type in client B and verify client A updates.
8. Verify the remote cursor label is visible in the other client.
9. Click Save JSON and confirm `/documents/editor-demo` returns
   `source: "explicit-save"`.
10. Close both clients and confirm `/rooms` eventually shows an idle room or no
    room after cleanup.

## AI Maintenance Guide

When using AI to modify this demo, keep the following prompt context:

```text
This is a local WebSocket collaboration demo for Lobe Editor.
Preserve the architecture: Lexical JSON is the persistence format, Y.Doc is the
runtime collaboration state, and WebSocket transports Yjs updates plus
awareness only. Do not move transport setup into the core Yjs plugin. Keep
server code demo-scoped and do not export it as part of the library API.
```

Useful AI tasks:

- explain the migration path from single-user JSON save to collaboration,
- extend diagnostics for `/rooms`,
- add local-only failure simulations,
- improve reconnect and idle-room cleanup behavior,
- generate manual or automated demo test steps.

Avoid asking AI to:

- turn WebSocket messages into JSON patch sync,
- hide transport creation inside the editor kernel/plugin,
- make this script production-ready by adding auth/database behavior in place,
- remove the explicit distinction between `/save` and `/snapshot`.
