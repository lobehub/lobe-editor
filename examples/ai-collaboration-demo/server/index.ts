import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { runAiTask } from './aiActor';
import {
  type AwarenessPayload,
  type DocumentUpdatePayload,
  addClient,
  applyAwarenessUpdate,
  applyDocumentUpdate,
  getSnapshot,
  removeClient,
  resetRoom,
} from './rooms';

const app = new Hono();

app.use('/api/*', cors());

app.get('/api/health', (context) =>
  context.json({
    ok: true,
    service: 'ai-collaboration-demo',
  }),
);

app.get('/api/workspaces/:workspaceId/pages/:pageId', (context) => {
  const workspaceId = context.req.param('workspaceId');
  const pageId = context.req.param('pageId');
  const titles: Record<string, string> = {
    'launch-notes': 'Q3 Launch Notes',
    'retrospective': 'Release Retrospective',
    'roadmap': 'Workspace Roadmap',
  };

  return context.json({
    page: {
      id: pageId,
      title: titles[pageId] ?? pageId,
      workspaceId,
    },
    roomId: `${workspaceId}:${pageId}`,
  });
});

app.get('/api/rooms/:roomId/snapshot', (context) => {
  return context.json(getSnapshot(context.req.param('roomId')));
});

app.post('/api/rooms/:roomId/update', async (context) => {
  const payload = await context.req.json<DocumentUpdatePayload>();
  applyDocumentUpdate(context.req.param('roomId'), payload);

  return context.json({ ok: true });
});

app.post('/api/rooms/:roomId/awareness', async (context) => {
  const payload = await context.req.json<AwarenessPayload>();
  applyAwarenessUpdate(context.req.param('roomId'), payload);

  return context.json({ ok: true });
});

app.post('/api/rooms/:roomId/ai-tasks', async (context) => {
  const payload = await context.req.json<{
    prompt?: string;
    selection?: {
      occurrenceIndex: number;
      selectedText: string;
    };
  }>();
  const result = await runAiTask(
    context.req.param('roomId'),
    payload.prompt ?? '',
    payload.selection,
  );

  return context.json(result);
});

app.delete('/api/rooms/:roomId', (context) => {
  resetRoom(context.req.param('roomId'));

  return context.json({ ok: true });
});

app.get('/api/rooms/:roomId/events', (context) => {
  const roomId = context.req.param('roomId');
  const clientID = Number(context.req.query('clientID'));
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    cancel: () => {
      removeClient(roomId, clientID);
    },
    start: (controller) => {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      addClient(roomId, {
        clientID,
        send,
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Content-Type': 'text/event-stream',
      'X-Accel-Buffering': 'no',
    },
  });
});

const port = Number(process.env.PORT ?? 8798);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.info(`Hono AI collaboration relay listening on http://localhost:${info.port}`);
  },
);
