/* eslint-disable @typescript-eslint/no-require-imports */

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { WebSocket, WebSocketServer } = require('ws');
const { Doc, applyUpdate, encodeStateAsUpdate, encodeStateVector } = require('yjs');

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
const LOBE_YJS_PROTOCOL = 'lobe-yjs-v1';
const LOBE_YJS_PROTOCOL_VERSION = 1;
const ENABLE_V1_PROTOCOL = process.env.YJS_DEMO_ENABLE_V1 !== '0';
const ALLOW_LEGACY_PROTOCOL = process.env.YJS_DEMO_ALLOW_LEGACY !== '0';
const REQUIRE_V1_AUTH = process.env.YJS_DEMO_REQUIRE_AUTH === '1';
const AUTH_TICKETS = new Set(
  String(process.env.YJS_DEMO_AUTH_TICKETS || '')
    .split(',')
    .map((ticket) => ticket.trim())
    .filter(Boolean),
);
const MAX_PROCESSED_MESSAGE_IDS = Number(process.env.YJS_DEMO_MAX_PROCESSED_MESSAGE_IDS || 10_000);
let nextServerClientId = 1;

const documents = new Map();
const documentMetadata = new Map();
const rooms = new Map();

function logRoomEvent(event, room, details = {}) {
  console.info(
    `[yjs-demo] ${JSON.stringify({
      awarenessCount: room.awareness.size,
      clientCount: room.clients.size,
      event,
      roomId: room.id,
      timestamp: new Date().toISOString(),
      ...details,
    })}`,
  );
}

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

function createProtocolMessage(type, fields = {}) {
  return {
    protocol: LOBE_YJS_PROTOCOL,
    type,
    version: LOBE_YJS_PROTOCOL_VERSION,
    ...fields,
  };
}

function isRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isSafeInteger(value) {
  return Number.isSafeInteger(value);
}

function isSerializedPosition(value) {
  if (!isRecord(value)) return false;

  const isPositionPart = (part) =>
    isRecord(part) && isSafeInteger(part.client) && isSafeInteger(part.clock);

  return (
    (value.assoc === undefined || typeof value.assoc === 'number') &&
    (value.item === undefined || isPositionPart(value.item)) &&
    (value.tname === undefined || value.tname === null || typeof value.tname === 'string') &&
    (value.type === undefined || isPositionPart(value.type))
  );
}

function isSerializedAwarenessState(value) {
  return (
    isRecord(value) &&
    (value.anchorPos === null || isSerializedPosition(value.anchorPos)) &&
    (value.focusPos === null || isSerializedPosition(value.focusPos)) &&
    (value.clientId === undefined || isSafeInteger(value.clientId)) &&
    typeof value.color === 'string' &&
    typeof value.focusing === 'boolean' &&
    typeof value.name === 'string' &&
    isRecord(value.awarenessData)
  );
}

function isV1Message(message) {
  return (
    isRecord(message) &&
    message.protocol === LOBE_YJS_PROTOCOL &&
    message.version === LOBE_YJS_PROTOCOL_VERSION &&
    typeof message.type === 'string'
  );
}

function validateV1Message(message) {
  if (!isV1Message(message)) return false;

  switch (message.type) {
    case 'auth':
      return (
        isSafeInteger(message.clientId) &&
        (message.clientKind === 'agent' || message.clientKind === 'browser') &&
        typeof message.nonce === 'string' &&
        (message.ticket === undefined ||
          message.ticket === null ||
          typeof message.ticket === 'string') &&
        (message.documentId === undefined || typeof message.documentId === 'string') &&
        (message.requestId === undefined || typeof message.requestId === 'string')
      );
    case 'awareness':
      return (
        isSafeInteger(message.sequence) &&
        (message.state === null || isSerializedAwarenessState(message.state))
      );
    case 'sync-request':
      return typeof message.stateVector === 'string';
    case 'update':
      return typeof message.messageId === 'string' && typeof message.update === 'string';
    default:
      return false;
  }
}

function sendV1Error(socket, code, message, fatal = true) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(
    JSON.stringify(
      createProtocolMessage('error', {
        code,
        fatal,
        message,
      }),
    ),
  );
}

function getV1ClientId() {
  const clientId = nextServerClientId;
  nextServerClientId += 1;
  return clientId;
}

function validateV1Auth(message, roomId) {
  if (REQUIRE_V1_AUTH && (!message.ticket || !AUTH_TICKETS.has(message.ticket))) {
    return {
      error: 'Invalid or expired collaboration ticket.',
    };
  }

  if (message.documentId !== undefined && message.documentId !== roomId) {
    return {
      error: 'Authenticated document does not match collaboration room.',
    };
  }

  if (AUTH_TICKETS.size > 0 && message.ticket && !AUTH_TICKETS.has(message.ticket)) {
    return {
      error: 'Invalid collaboration ticket.',
    };
  }

  return {
    clientId: getV1ClientId(),
  };
}

function rememberProcessedMessageId(room, messageId) {
  room.processedMessageIds.add(messageId);

  while (room.processedMessageIds.size > MAX_PROCESSED_MESSAGE_IDS) {
    const oldest = room.processedMessageIds.values().next().value;
    if (oldest === undefined) return;
    room.processedMessageIds.delete(oldest);
  }
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
      awarenessSequences: new Map(),
      bootstrapOwner: null,
      bootstrapOwnerClientId: null,
      clients: new Set(),
      deferredSyncClients: new Map(),
      doc: new Doc(),
      hasReceivedUpdate: false,
      id,
      lastActiveAt: now,
      lastEmptyAt: now,
      processedMessageIds: new Set(),
    };
    rooms.set(id, room);
    logRoomEvent('room.created', room);
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
  logRoomEvent('room.evicted', room, { reason });
  room.doc.destroy();
  room.awareness.clear();
  room.awarenessSequences.clear();
  room.deferredSyncClients.clear();
  rooms.delete(room.id);
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

function broadcast(room, sender, message, protocolMode) {
  const payload = JSON.stringify(message);

  for (const client of room.clients) {
    if (
      client === sender ||
      client.readyState !== WebSocket.OPEN ||
      (protocolMode &&
        (client.protocolMode !== protocolMode || (protocolMode === 'v1' && !client.authenticated)))
    ) {
      continue;
    }

    client.send(payload);
  }
}

function sendRoomSync(room, socket, clientId, stateVector) {
  if (socket.readyState !== WebSocket.OPEN || socket.hasSentInitialSync) {
    return;
  }

  const initialUpdate = stateVector
    ? encodeStateAsUpdate(room.doc, stateVector)
    : encodeStateAsUpdate(room.doc);
  socket.hasSentInitialSync = true;
  logRoomEvent('sync.sent', room, {
    clientId,
    stateBytes: initialUpdate.byteLength,
    stateVectorBytes: stateVector?.byteLength || 0,
  });
  const awareness = Array.from(room.awareness, ([awarenessClientId, state]) => ({
    clientId: awarenessClientId,
    sequence: room.awarenessSequences?.get(awarenessClientId) || 0,
    state,
  }));

  if (socket.protocolMode === 'v1') {
    socket.send(
      JSON.stringify(
        createProtocolMessage('sync', {
          awareness,
          serverStateVector: encodeUpdate(encodeStateVector(room.doc)),
          update: encodeUpdate(initialUpdate),
        }),
      ),
    );
    return;
  }

  socket.send(
    JSON.stringify({
      awareness,
      type: 'sync',
      update: encodeUpdate(initialUpdate),
    }),
  );
}

function isBootstrapEligible(socket) {
  return socket.authenticated && socket.clientKind === 'browser';
}

function assignBootstrapOwner(room, socket, clientId) {
  room.bootstrapOwner = socket;
  room.bootstrapOwnerClientId = clientId;
  logRoomEvent('bootstrap.owner-assigned', room, { clientId });

  if (socket.syncRequestStateVector) {
    sendRoomSync(room, socket, clientId, socket.syncRequestStateVector);
  }
}

function flushDeferredSyncClients(room) {
  const deferredClients = Array.from(room.deferredSyncClients);
  room.deferredSyncClients.clear();

  for (const [socket, clientId] of deferredClients) {
    sendRoomSync(room, socket, clientId, socket.syncRequestStateVector);
  }
}

function completeRoomBootstrap(room, clientId) {
  if (room.hasReceivedUpdate) {
    return;
  }

  room.hasReceivedUpdate = true;
  room.bootstrapOwner = null;
  room.bootstrapOwnerClientId = null;
  logRoomEvent('bootstrap.completed', room, {
    clientId,
    deferredClientCount: room.deferredSyncClients.size,
  });
  flushDeferredSyncClients(room);
}

function releaseBootstrapClient(room, socket) {
  room.deferredSyncClients.delete(socket);

  if (room.bootstrapOwner !== socket || room.hasReceivedUpdate) {
    return;
  }

  room.bootstrapOwner = null;
  room.bootstrapOwnerClientId = null;

  const nextOwner = Array.from(room.deferredSyncClients).find(
    ([candidate]) => candidate.readyState === WebSocket.OPEN && isBootstrapEligible(candidate),
  );

  if (!nextOwner) {
    return;
  }

  const [nextSocket, nextClientId] = nextOwner;
  room.deferredSyncClients.delete(nextSocket);
  assignBootstrapOwner(room, nextSocket, nextClientId);
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
    bootstrapClientId: room.bootstrapOwnerClientId,
    clientCount: room.clients.size,
    deferredSyncClientCount: room.deferredSyncClients.size,
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
  const clientIdParam = url.searchParams.get('clientId');
  const requestedClientId = Number(clientIdParam);
  let clientId =
    clientIdParam !== null && Number.isSafeInteger(requestedClientId) && requestedClientId >= 0
      ? requestedClientId
      : Date.now();
  const room = getRoom(id);

  socket.isAlive = true;
  socket.authenticated = false;
  socket.hasSentInitialSync = false;
  socket.lastAwarenessSequence = -1;
  socket.clientKind = null;
  socket.protocolMode = 'unknown';
  socket.helloNonce = crypto.randomUUID();
  socket.syncRequestStateVector = undefined;
  socket.on('pong', () => {
    socket.isAlive = true;
  });

  room.clients.add(socket);
  room.lastActiveAt = Date.now();
  room.lastEmptyAt = null;
  logRoomEvent('client.connected', room, { clientId });

  if (ENABLE_V1_PROTOCOL && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify(
        createProtocolMessage('hello', {
          nonce: socket.helloNonce,
          roomId: id,
        }),
      ),
    );
  }

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

    if (isV1Message(message)) {
      if (!ENABLE_V1_PROTOCOL || !validateV1Message(message)) {
        sendV1Error(socket, 'invalid_message', 'Invalid lobe-yjs-v1 message.');
        socket.close(1003, 'Invalid lobe-yjs-v1 message.');
        return;
      }

      if (message.type === 'auth') {
        if (socket.protocolMode === 'v1' || socket.authenticated) {
          sendV1Error(
            socket,
            'already_authenticated',
            'The collaboration client is already authenticated.',
          );
          socket.close(1008, 'Already authenticated.');
          return;
        }

        if (Object.hasOwn(message, 'sender') || message.nonce !== socket.helloNonce) {
          sendV1Error(socket, 'invalid_auth', 'The collaboration auth nonce is invalid.');
          socket.close(1008, 'Invalid collaboration auth.');
          return;
        }

        const authResult = validateV1Auth(message, id);
        if (authResult.error) {
          sendV1Error(socket, 'unauthorized', authResult.error);
          socket.close(1008, authResult.error);
          return;
        }

        clientId = authResult.clientId;
        socket.clientId = clientId;
        socket.clientKind = message.clientKind;
        socket.protocolMode = 'v1';
        socket.authenticated = true;
        socket.lastAwarenessSequence = -1;
        room.lastActiveAt = Date.now();
        socket.send(
          JSON.stringify(
            createProtocolMessage('auth-ok', {
              clientId,
              roomId: id,
            }),
          ),
        );
        logRoomEvent('client.authenticated', room, {
          clientId,
          clientKind: message.clientKind,
          requestId: message.requestId || null,
        });
        return;
      }

      if (socket.protocolMode !== 'v1' || !socket.authenticated) {
        sendV1Error(socket, 'unauthorized', 'Authenticate before using the collaboration room.');
        socket.close(1008, 'Authentication required.');
        return;
      }

      if (Object.hasOwn(message, 'sender')) {
        sendV1Error(socket, 'sender_forbidden', 'Clients must not provide a sender identity.');
        socket.close(1008, 'Sender identity is server assigned.');
        return;
      }

      if (message.type === 'sync-request') {
        try {
          socket.syncRequestStateVector = decodeUpdate(message.stateVector);
          room.lastActiveAt = Date.now();

          if (room.hasReceivedUpdate) {
            sendRoomSync(room, socket, clientId, socket.syncRequestStateVector);
          } else if (!isBootstrapEligible(socket)) {
            room.deferredSyncClients.set(socket, clientId);
            logRoomEvent('sync.deferred', room, {
              clientId,
              reason: 'agent-awaiting-browser-bootstrap',
            });
          } else if (!room.bootstrapOwner) {
            room.deferredSyncClients.delete(socket);
            assignBootstrapOwner(room, socket, clientId);
          } else if (room.bootstrapOwner === socket) {
            sendRoomSync(room, socket, clientId, socket.syncRequestStateVector);
          } else {
            room.deferredSyncClients.set(socket, clientId);
            logRoomEvent('sync.deferred', room, {
              bootstrapClientId: room.bootstrapOwnerClientId,
              clientId,
            });
          }
        } catch {
          logRoomEvent('sync.rejected', room, { clientId, reason: 'invalid state vector' });
          sendV1Error(socket, 'invalid_state_vector', 'Invalid Yjs state vector.');
          socket.close(1003, 'Invalid Yjs state vector.');
        }
        return;
      }

      if (message.type === 'update') {
        if (room.processedMessageIds.has(message.messageId)) {
          socket.send(
            JSON.stringify(
              createProtocolMessage('update-ack', {
                messageId: message.messageId,
              }),
            ),
          );
          return;
        }

        let update;
        try {
          update = decodeUpdate(message.update);
          applyUpdate(room.doc, update, socket);
        } catch {
          logRoomEvent('update.rejected', room, { clientId, reason: 'invalid update' });
          sendV1Error(socket, 'invalid_update', 'Invalid Yjs update.');
          socket.close(1003, 'Invalid Yjs update.');
          return;
        }

        rememberProcessedMessageId(room, message.messageId);
        room.lastActiveAt = Date.now();
        completeRoomBootstrap(room, clientId);
        const outboundMessage = createProtocolMessage('update', {
          messageId: message.messageId,
          sender: clientId,
          update: message.update,
        });
        logRoomEvent('update.applied', room, {
          clientId,
          messageId: message.messageId,
          stateBytes: encodeStateAsUpdate(room.doc).byteLength,
          updateBytes: update.byteLength,
        });
        broadcast(room, socket, outboundMessage, 'v1');
        socket.send(
          JSON.stringify(
            createProtocolMessage('update-ack', {
              messageId: message.messageId,
            }),
          ),
        );
        return;
      }

      if (message.type === 'awareness') {
        if (message.sequence <= socket.lastAwarenessSequence) return;

        socket.lastAwarenessSequence = message.sequence;
        if (message.state) {
          room.awareness.set(clientId, message.state);
        } else {
          room.awareness.delete(clientId);
        }
        room.awarenessSequences.set(clientId, message.sequence);
        room.lastActiveAt = Date.now();
        const outboundMessage = createProtocolMessage('awareness', {
          sender: clientId,
          sequence: message.sequence,
          state: message.state,
        });
        logRoomEvent('awareness.updated', room, {
          clientId,
          focusing: Boolean(message.state?.focusing),
          hasSelection: Boolean(message.state?.anchorPos && message.state?.focusPos),
          name: typeof message.state?.name === 'string' ? message.state.name : null,
        });
        broadcast(room, socket, outboundMessage, 'v1');
        return;
      }

      sendV1Error(socket, 'unsupported_message', 'Unsupported collaboration message.');
      return;
    }

    if (socket.protocolMode === 'v1') {
      sendV1Error(socket, 'protocol_mismatch', 'Use lobe-yjs-v1 for this connection.');
      socket.close(1008, 'Protocol mismatch.');
      return;
    }

    if (!ALLOW_LEGACY_PROTOCOL) {
      socket.close(1008, 'Legacy collaboration protocol is disabled.');
      return;
    }

    socket.protocolMode = 'legacy';
    socket.authenticated = true;
    socket.clientKind = 'browser';

    if (message.type === 'sync-request') {
      try {
        socket.syncRequestStateVector = decodeUpdate(message.stateVector);
        room.lastActiveAt = Date.now();

        if (room.hasReceivedUpdate) {
          sendRoomSync(room, socket, clientId, socket.syncRequestStateVector);
        } else if (!room.bootstrapOwner) {
          room.deferredSyncClients.delete(socket);
          assignBootstrapOwner(room, socket, clientId);
        } else if (room.bootstrapOwner === socket) {
          sendRoomSync(room, socket, clientId, socket.syncRequestStateVector);
        } else {
          room.deferredSyncClients.set(socket, clientId);
          logRoomEvent('sync.deferred', room, {
            bootstrapClientId: room.bootstrapOwnerClientId,
            clientId,
          });
        }
      } catch {
        logRoomEvent('sync.rejected', room, { clientId, reason: 'invalid state vector' });
        socket.close(1003, 'Invalid Yjs state vector.');
      }
      return;
    }

    if (message.type === 'update') {
      let update;
      try {
        update = decodeUpdate(message.update);
        applyUpdate(room.doc, update, socket);
      } catch {
        logRoomEvent('update.rejected', room, { clientId, reason: 'invalid update' });
        socket.close(1003, 'Invalid Yjs update.');
        return;
      }
      room.lastActiveAt = Date.now();
      completeRoomBootstrap(room, clientId);
      logRoomEvent('update.applied', room, {
        clientId,
        stateBytes: encodeStateAsUpdate(room.doc).byteLength,
        updateBytes: update.byteLength,
      });
      broadcast(room, socket, { ...message, sender: clientId }, 'legacy');
      return;
    }

    if (message.type === 'awareness') {
      if (message.state) {
        room.awareness.set(clientId, message.state);
      } else {
        room.awareness.delete(clientId);
      }
      room.awarenessSequences.set(clientId, 0);

      logRoomEvent('awareness.updated', room, {
        clientId,
        editingBlock: message.state?.awarenessData?.editingBlock?.key || null,
        focusing: Boolean(message.state?.focusing),
        hasSelection: Boolean(message.state?.anchorPos && message.state?.focusPos),
        name: typeof message.state?.name === 'string' ? message.state.name : null,
      });
      broadcast(room, socket, { ...message, sender: clientId }, 'legacy');
    }
  });

  socket.on('close', () => {
    releaseBootstrapClient(room, socket);
    room.clients.delete(socket);
    room.awareness.delete(clientId);
    room.awarenessSequences.delete(clientId);
    if (socket.protocolMode === 'v1' && socket.authenticated) {
      broadcast(
        room,
        socket,
        createProtocolMessage('awareness', {
          sender: clientId,
          sequence: socket.lastAwarenessSequence + 1,
          state: null,
        }),
        'v1',
      );
    } else if (socket.protocolMode === 'legacy') {
      broadcast(
        room,
        socket,
        {
          sender: clientId,
          state: null,
          type: 'awareness',
        },
        'legacy',
      );
    }

    if (room.clients.size === 0) {
      room.awareness.clear();
      room.lastEmptyAt = Date.now();
    }

    logRoomEvent('client.disconnected', room, {
      clientId,
      idleSince: toIsoString(room.lastEmptyAt),
    });
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
    console.info(
      `[yjs-demo] ${JSON.stringify({
        cleanupIntervalMs: ROOM_CLEANUP_INTERVAL_MS,
        event: 'server.config',
        heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
        maxIdleRooms: MAX_IDLE_ROOMS,
        roomIdleTtlMs: ROOM_IDLE_TTL_MS,
        timestamp: new Date().toISOString(),
      })}`,
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
