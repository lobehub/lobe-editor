# AI Collaboration Demo

This demo shows a Node-side AI actor joining the same collaboration room as human editors.

The important behavior is that the AI does not patch persisted content directly. It uses tools that mutate its own `Y.Doc`, then the server broadcasts the resulting Yjs update through the same room relay used by human clients.

## Run

```bash
npx pnpm@10.20.0 install --lockfile=false
npx pnpm@10.20.0 run dev
```

Client: <http://localhost:5175>

Relay: <http://localhost:8798>

## Model Environment

The Node actor reads:

```bash
ANTHROPIC_BASE_URL=...
ANTHROPIC_AUTH_TOKEN=...
```

It calls an Anthropic-compatible `/v1/messages` endpoint with:

```text
model: deepseek-v4-pro
```

If either environment variable is missing, the actor falls back to a deterministic mock model so the collaboration path still works locally.

## Prompt Contract

The system prompt lives in `server/aiTools.ts`.

It tells the model:

- act as a visible collaborator, not a background patch
- always use tools
- first set the AI selection
- then write a small edit
- finally finish the task
- never replace the whole document

## Tools

The demo exposes three tools to the model:

- `set_ai_selection`: moves the AI awareness cursor to `document_end`
- `append_paragraph`: appends one paragraph through the AI actor `Y.Doc`
- `finish_task`: marks the AI task as done and leaves the final cursor visible

Those tool calls are executed in `server/aiActor.ts`.

Future extensions should add tools like `replace_selection`, `insert_after_block`, or `comment_on_range` instead of allowing full-document replacement.
