# Collaboration Business Demo

This demo validates the intended business integration shape for `@lobehub/editor` collaboration:

| Layer             | Responsibility                                                   |
| ----------------- | ---------------------------------------------------------------- |
| Hono server       | Room snapshot, Yjs update relay, awareness relay                 |
| Vite React app    | Workspace/page routing shell, provider factory, editor embedding |
| `@lobehub/editor` | Lexical/Yjs binding, cursor rendering, bootstrap/hydrate         |

## Run

```bash
pnpm install --lockfile=false
pnpm dev
```

Open:

```text
http://localhost:5174
```

The Hono relay listens on `http://localhost:8797` by default; Vite proxies `/api` to it.

The page renders simulated browser clients for the same workspace page. Each client owns an independent `Y.Doc` and connects to the Hono room relay through the same `Editor` `collaboration` prop shape that a business page would use.

## Covered Scenarios

| Scenario                          | Demo control                                                      |
| --------------------------------- | ----------------------------------------------------------------- |
| First editor enters an empty page | Alice bootstraps JSON into an empty Y.Doc room                    |
| Later editor enters the same page | Bo hydrates from the server room snapshot                         |
| User leaves and rejoins           | Remove/Rejoin Bo                                                  |
| Client remounts in the same page  | Re-enter clients                                                  |
| Temporary network/session detach  | Disconnect/Reconnect inside each pane                             |
| Workspace page switch             | Page segmented control                                            |
| Read-only viewer presence         | Show/Hide observer                                                |
| Complex editor nodes              | Initial content includes list, table, image, and code block nodes |
| Room reset/backfill retry         | Reset room                                                        |

Permission and authorization checks are intentionally excluded from this local demo.

## Scope

This is intentionally not production infrastructure. It keeps room state in memory, uses Server-Sent Events for the local relay, and resets on server restart. Its purpose is to validate the integration boundary before wiring a persistent provider in the production application.
