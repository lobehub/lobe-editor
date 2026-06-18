const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { WebSocket, WebSocketServer } = require('ws');
const { Doc, applyUpdate, encodeStateAsUpdate } = require('yjs');

const PORT = Number(process.env.YJS_DEMO_PORT || 12_345);
const DEFAULT_DOCUMENT_ID = 'editor-demo';
const MAX_HTTP_BODY_BYTES = Number(process.env.YJS_DEMO_MAX_HTTP_BODY_BYTES || 2 * 1024 * 1024);
const MAX_WS_MESSAGE_BYTES = Number(process.env.YJS_DEMO_MAX_WS_MESSAGE_BYTES || 2 * 1024 * 1024);
const ROOM_IDLE_TTL_MS = Number(process.env.YJS_DEMO_ROOM_IDLE_TTL_MS || 30 * 60 * 1000);
const ROOM_CLEANUP_INTERVAL_MS = Number(process.env.YJS_DEMO_ROOM_CLEANUP_INTERVAL_MS || 60 * 1000);
const HEARTBEAT_INTERVAL_MS = Number(process.env.YJS_DEMO_HEARTBEAT_INTERVAL_MS || 30 * 1000);
const MAX_IDLE_ROOMS = Number(process.env.YJS_DEMO_MAX_IDLE_ROOMS || 20);
const ROOM_HEAP_PRESSURE_MIN_BYTES = Number(
  process.env.YJS_DEMO_ROOM_HEAP_PRESSURE_MIN_BYTES || 256 * 1024 * 1024,
);
const ROOM_HEAP_PRESSURE_RATIO = Number(process.env.YJS_DEMO_ROOM_HEAP_PRESSURE_RATIO || 0.8);

const documents = new Map();
const documentMetadata = new Map();
const rooms = new Map();

function cloneJson(value) {
  return structuredClone(value);
}

function toIsoString(value) {
  return value ? new Date(value).toISOString() : null;
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function encodeUpdate(update) {
  return Buffer.from(update).toString('base64');
}

function decodeUpdate(update) {
  return new Uint8Array(Buffer.from(update, 'base64'));
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(data));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let isRejected = false;

    request.on('data', (chunk) => {
      if (isRejected) {
        return;
      }

      size += Buffer.byteLength(chunk);

      if (size > MAX_HTTP_BODY_BYTES) {
        isRejected = true;
        reject(createHttpError(413, 'Request body is too large.'));
        request.destroy();
        return;
      }

      body += chunk;
    });
    request.on('end', () => {
      if (isRejected) {
        return;
      }

      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        error.statusCode = 400;
        reject(error);
      }
    });
    request.on('error', (error) => {
      if (!isRejected) {
        reject(error);
      }
    });
  });
}

async function loadDefaultDocument() {
  const dataPath = path.resolve(__dirname, '../src/react/Editor/demos/data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  saveDocumentContent(DEFAULT_DOCUMENT_ID, data, 'seed');
}

function saveDocumentContent(id, content, source) {
  const savedAt = new Date().toISOString();
  const version = (documentMetadata.get(id)?.version || 0) + 1;
  documents.set(id, cloneJson(content));
  documentMetadata.set(id, {
    savedAt,
    source,
    version,
  });

  return {
    content: getDocument(id),
    id,
    savedAt,
    source,
    version,
  };
}

function getDocument(id) {
  if (!documents.has(id)) {
    saveDocumentContent(id, documents.get(DEFAULT_DOCUMENT_ID), 'seed-copy');
  }

  return cloneJson(documents.get(id));
}

function getDocumentEnvelope(id) {
  const content = getDocument(id);
  const metadata = documentMetadata.get(id);

  return {
    content,
    id,
    savedAt: metadata?.savedAt || null,
    source: metadata?.source || null,
    version: metadata?.version || 0,
  };
}

function getRoom(id) {
  let room = rooms.get(id);

  if (!room) {
    const now = Date.now();
    room = {
      awareness: new Map(),
      clients: new Set(),
      doc: new Doc(),
      id,
      lastActiveAt: now,
      lastEmptyAt: now,
    };
    rooms.set(id, room);
  }

  return room;
}

function isRoomIdle(room) {
  return room.clients.size === 0;
}

function getIdleRooms() {
  return Array.from(rooms.values())
    .filter(isRoomIdle)
    .sort((a, b) => a.lastEmptyAt - b.lastEmptyAt);
}

function hasHeapPressure() {
  const { heapTotal, heapUsed } = process.memoryUsage();

  return (
    heapUsed >= ROOM_HEAP_PRESSURE_MIN_BYTES &&
    heapTotal > 0 &&
    heapUsed / heapTotal >= ROOM_HEAP_PRESSURE_RATIO
  );
}

function getMemoryStats() {
  const { heapTotal, heapUsed, rss } = process.memoryUsage();

  return {
    heapPressureMinBytes: ROOM_HEAP_PRESSURE_MIN_BYTES,
    heapPressureRatio: heapTotal > 0 ? heapUsed / heapTotal : 0,
    heapPressureThreshold: ROOM_HEAP_PRESSURE_RATIO,
    heapTotal,
    heapUsed,
    rss,
  };
}

function evictRoom(room, reason) {
  room.doc.destroy();
  room.awareness.clear();
  rooms.delete(room.id);
  console.info(`[yjs-demo] evicted idle room "${room.id}" (${reason})`);
}

function cleanupIdleRooms() {
  const now = Date.now();

  for (const room of getIdleRooms()) {
    if (now - room.lastEmptyAt >= ROOM_IDLE_TTL_MS) {
      evictRoom(room, 'idle ttl');
    }
  }

  let idleRooms = getIdleRooms();
  while (idleRooms.length > MAX_IDLE_ROOMS) {
    evictRoom(idleRooms[0], 'idle room limit');
    idleRooms = getIdleRooms();
  }

  while (hasHeapPressure()) {
    idleRooms = getIdleRooms();

    if (idleRooms.length === 0) {
      return;
    }

    evictRoom(idleRooms[0], 'heap pressure');
  }
}

function broadcast(room, sender, message) {
  const payload = JSON.stringify(message);

  for (const client of room.clients) {
    if (client === sender || client.readyState !== WebSocket.OPEN) {
      continue;
    }

    client.send(payload);
  }
}

function getRawMessageSize(rawMessage) {
  if (typeof rawMessage === 'string') {
    return Buffer.byteLength(rawMessage);
  }

  if (Buffer.isBuffer(rawMessage)) {
    return rawMessage.byteLength;
  }

  if (Array.isArray(rawMessage)) {
    return rawMessage.reduce((total, item) => total + getRawMessageSize(item), 0);
  }

  if (rawMessage instanceof ArrayBuffer) {
    return rawMessage.byteLength;
  }

  return Buffer.byteLength(String(rawMessage));
}

function getAwarenessDiagnostics(room) {
  return Array.from(room.awareness, ([clientId, state]) => ({
    clientId,
    editingBlock: state?.awarenessData?.editingBlock || null,
    focusing: !!state?.focusing,
    hasSelection: !!state?.anchorPos && !!state?.focusPos,
    name: typeof state?.name === 'string' ? state.name : null,
  }));
}

function getRoomsDiagnostics() {
  const roomList = Array.from(rooms.values()).map((room) => ({
    awareness: getAwarenessDiagnostics(room),
    awarenessCount: room.awareness.size,
    clientCount: room.clients.size,
    id: room.id,
    lastActiveAt: toIsoString(room.lastActiveAt),
    lastEmptyAt: toIsoString(room.lastEmptyAt),
    status: room.clients.size > 0 ? 'active' : 'idle',
  }));

  return {
    activeRooms: roomList.filter((room) => room.status === 'active').length,
    idleRooms: roomList.filter((room) => room.status === 'idle').length,
    memory: getMemoryStats(),
    rooms: roomList,
    totalRooms: roomList.length,
  };
}

function getWriteSource(pathname) {
  if (pathname.endsWith('/snapshot')) {
    return 'snapshot';
  }

  if (pathname.endsWith('/save')) {
    return 'explicit-save';
  }

  return null;
}

async function handleHttpRequest(request, response) {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  const documentMatch = url.pathname.match(/^\/documents\/([^/]+)$/);
  const writeMatch = url.pathname.match(/^\/documents\/([^/]+)\/(save|snapshot)$/);

  if (request.method === 'GET' && url.pathname === '/rooms') {
    sendJson(response, 200, getRoomsDiagnostics());
    return;
  }

  if (request.method === 'GET' && documentMatch) {
    const id = decodeURIComponent(documentMatch[1]);
    sendJson(response, 200, getDocumentEnvelope(id));
    return;
  }

  if (request.method === 'POST' && writeMatch) {
    const id = decodeURIComponent(writeMatch[1]);
    const source = getWriteSource(url.pathname);
    const body = await readRequestBody(request);

    if (!body || typeof body !== 'object' || !('content' in body)) {
      sendJson(response, 400, { error: 'Save request requires a content field.' });
      return;
    }

    sendJson(response, 200, saveDocumentContent(id, body.content, source));
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
}

function handleSocketConnection(socket, request) {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  const roomMatch = url.pathname.match(/^\/collaboration\/([^/]+)$/);

  if (!roomMatch) {
    socket.close(1008, 'Invalid collaboration room.');
    return;
  }

  const id = decodeURIComponent(roomMatch[1]);
  const clientId = Number(url.searchParams.get('clientId') || Date.now());
  const room = getRoom(id);

  socket.isAlive = true;
  socket.on('pong', () => {
    socket.isAlive = true;
  });

  room.clients.add(socket);
  room.lastActiveAt = Date.now();
  room.lastEmptyAt = null;

  // Storage stays JSON. The browser loads JSON over HTTP first, then the editor/Yjs
  // plugin bootstraps that state into this empty runtime Y.Doc room.
  socket.send(
    JSON.stringify({
      awareness: Array.from(room.awareness, ([awarenessClientId, state]) => ({
        clientId: awarenessClientId,
        state,
      })),
      type: 'sync',
      update: encodeUpdate(encodeStateAsUpdate(room.doc)),
    }),
  );

  socket.on('message', (rawMessage) => {
    let message;

    if (getRawMessageSize(rawMessage) > MAX_WS_MESSAGE_BYTES) {
      socket.close(1009, 'Message is too large.');
      return;
    }

    try {
      message = JSON.parse(String(rawMessage));
    } catch {
      socket.close(1003, 'Invalid JSON message.');
      return;
    }

    if (message.type === 'update') {
      try {
        applyUpdate(room.doc, decodeUpdate(message.update), socket);
      } catch {
        socket.close(1003, 'Invalid Yjs update.');
        return;
      }
      room.lastActiveAt = Date.now();
      broadcast(room, socket, message);
      return;
    }

    if (message.type === 'awareness') {
      if (message.state) {
        room.awareness.set(message.sender, message.state);
      } else {
        room.awareness.delete(message.sender);
      }

      broadcast(room, socket, message);
    }
  });

  socket.on('close', () => {
    room.clients.delete(socket);
    room.awareness.delete(clientId);
    broadcast(room, socket, {
      sender: clientId,
      state: null,
      type: 'awareness',
    });

    if (room.clients.size === 0) {
      room.awareness.clear();
      room.lastEmptyAt = Date.now();
    }
  });
}

function startHeartbeat(wsServer) {
  const heartbeatTimer = setInterval(() => {
    for (const socket of wsServer.clients) {
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }

      socket.isAlive = false;
      socket.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  heartbeatTimer.unref();
}

async function start() {
  await loadDefaultDocument();

  const server = http.createServer((request, response) => {
    handleHttpRequest(request, response).catch((error) => {
      console.error('[yjs-demo] request failed', error);
      sendJson(response, error.statusCode || 500, {
        error: error.statusCode ? error.message : 'Internal server error',
      });
    });
  });
  const wsServer = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    wsServer.handleUpgrade(request, socket, head, (websocket) => {
      handleSocketConnection(websocket, request);
    });
  });

  server.listen(PORT, () => {
    console.info(`[yjs-demo] HTTP server: http://localhost:${PORT}`);
    console.info(
      `[yjs-demo] WebSocket: ws://localhost:${PORT}/collaboration/${DEFAULT_DOCUMENT_ID}`,
    );
    console.info(
      `[yjs-demo] Idle rooms are retained until TTL, room limit, or heap pressure cleanup.`,
    );
  });

  const cleanupTimer = setInterval(cleanupIdleRooms, ROOM_CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
  startHeartbeat(wsServer);
}

start().catch((error) => {
  console.error('[yjs-demo] failed to start', error);
  process.exitCode = 1;
});
