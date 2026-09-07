# Lexical/Yjs compatibility and upgrade checklist

This is a maintenance checklist for the private compatibility boundaries used
by `@lobehub/editor`. It is intentionally not an exhaustive proof that an
arbitrary Lexical or Yjs upgrade is safe.

## Supported baseline

The supported pinned Lexical line is `0.42.0`:

- `lexical`: `0.42.0`
- `@lexical/yjs`: `0.42.0`
- `yjs`: package range `^13.6.31` (the current highest-resolution install is
  observed as `13.6.32`; this is not an exact yjs pin)

The root `.npmrc` intentionally has `lockfile=false` and
`resolution-mode=highest`, so the resolved yjs patch-level version must be
reported separately from the package manifest range.

Before changing these versions, run the compatibility guards and review every
boundary below. A version mismatch in the guard is an instruction to review
this checklist and the relevant upstream release, not permission to update a
hash or silently skip a failed test.

## Private compatibility inventory

| Boundary                                                                                                                          | Current callsites                                                                                                                                                                                                            | Guard or behavioral coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lexical `EditorState` parse callback and process-global key allocator (`resetRandomKey`)                                          | `src/editor-kernel/index.ts` re-export, `src/plugins/common/data-source/json-data-source.ts`, `src/plugins/litexml/data-source/litexml-data-source.ts`, and their keep-id import paths                                       | The installed-version/artifact-layout/marker guard checks CJS/ESM files. The patch suite executes the real dev/prod CJS and ESM artifacts, verifies the parse callback receives the state, and verifies callback-scoped reset behavior. Numeric and no-argument resets intentionally retain their reset semantics and may lower the watermark. Markdown/Yjs `parseEditorState` calls do not use the patched callback.                                                                                                                                                                                                                                   |
| Lexical `EditorState._nodeMap`, runtime node keys, and `keepId` imports                                                           | `src/plugins/common/data-source/json-data-source.ts`, `src/plugins/markdown/data-source/markdown-data-source.ts`, `src/plugins/litexml/data-source/litexml-data-source.ts`, and `src/plugins/litexml/command/diffCommand.ts` | `src/editor-kernel/__tests__/lexical-patch.test.ts` and `cross-editor-key-collision.test.ts` cover callback identity, imported IDs, watermark restoration, and cross-editor allocation. These are behavior tests, not a public guarantee for arbitrary Lexical internals.                                                                                                                                                                                                                                                                                                                                                                               |
| `@lexical/yjs` Binding, `collabNodeMap`, Y.XmlText/Y.XmlElement caches, and shared-item IDs (`_item.id`)                          | `src/plugins/yjs/plugin/index.ts`, `src/plugins/yjs/plugin/utils/sync.ts`, `src/plugins/yjs/plugin/properties-provider.ts`, properties identity migration                                                                    | `external-snapshot.test.ts`, `reconnect-snapshot-duplicate.test.ts`, `sync-hydration.test.ts`, and Agent/browser collaboration suites cover real synchronization and identity behavior. The Yjs package version/artifact guard checks the installed CJS/ESM layout; the patch hashes remain enforced by `scripts/postinstall-lexical-patch.cjs`.                                                                                                                                                                                                                                                                                                        |
| Detached Yjs shared types and `__state` synchronization                                                                           | Patched `@lexical/yjs` `syncNodeStateFromLexical` path                                                                                                                                                                       | Existing Yjs external-snapshot and annotation-state behavior suites exercise detached/reloaded state. The postinstall hash guard is the direct artifact-shape guard for the backport.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Yjs local undo internals: `Item.content`, `type._start`, `type._map`, and `doc.store.clients`                                     | `src/plugins/yjs/plugin/utils/history.ts` foreign-edit filtering and per-client UndoManager boundaries                                                                                                                       | `history.test.ts`, `annotation-history.test.ts`, `dom-undo-projection.test.ts`, `agent-remote-undo-artifact-code.test.ts`, and reconnect local-edit/undo coverage exercise behavior. The private field references are direct shape dependencies; this inventory does not claim exhaustive Yjs internals coverage.                                                                                                                                                                                                                                                                                                                                       |
| Lexical command/update scheduling, `COLLABORATION_TAG`, `HISTORIC_TAG`, `onUpdate`, and rewrite commit boundaries                 | `src/plugins/yjs/plugin/utils/sync.ts`, `src/plugins/common/node/hole-controller.ts`, `src/plugins/litexml/command/rewriteRange.ts`, `src/plugins/litexml/command/gateway.ts`, `src/headless/collaborative-agent-editor.ts`  | `sync-hydration.test.ts`, reconnect tests, Agent lifecycle tests, and focused command/history suites cover ordering and no-echo behavior. `RewriteService` uses the per-update `onUpdate` callback as the local Lexical commit boundary; it does not depend on an exact number or order of microtasks. A kernel error or an unchanged editor state rejects a presumed commit. Its bounded 0 ms timer only fails a request when that callback never arrives; the timer never proves success. The resulting `stateVector` is local commit evidence, not a remote Yjs update acknowledgement; callers use the provider acknowledgement barrier separately. |
| Derived DOM subtree cache `HTMLElement.__lexicalTextContent`: inner Hole content-slot creation and outer Hole DOM fast-path reuse | `src/plugins/yjs/plugin/utils/sync.ts` hydration boundary                                                                                                                                                                    | `sync-hydration.test.ts` uses a real DOM-backed Quote→Hole tree. It fails loudly if the installed supported Lexical artifact no longer creates the inner content-slot cache, then drives clean outer-Hole reuse/deletion/rebuild and compares public root text with semantic `ElementNode` text. The runtime boundary invalidates only the outer derived cache; it never writes `RootNode.__cachedText`. The suite also covers discrete and non-discrete hydration with zero Yjs updates and no Lexical undo item.                                                                                                                                      |

The cache guard is deliberately a field-shape/lifecycle guard for one known
private dependency. It does not invent the property on a mock and does not
claim that all private DOM or Lexical fields are covered.

## Patch scope and verification

`pnpm.patchedDependencies` applies the two checked-in patches:

- `patches/lexical@0.42.0.patch`: passes the parsed `EditorState` to the
  `parseEditorState` callback and adds callback-scoped `resetRandomKey`
  behavior that does not lower a later key watermark. Numeric and no-argument
  resets intentionally retain their reset semantics.
- `patches/@lexical__yjs@0.42.0.patch`: avoids reading detached shared-type
  state when `sharedType.doc === null`.

`scripts/postinstall-lexical-patch.cjs` is the source of truth for the expected
SHA-256 hashes of all four Lexical and four Lexical/Yjs dev/prod CJS/ESM
artifacts. Do not duplicate or manually rotate those hashes in tests. The
compatibility test checks package versions and artifact presence; postinstall
continues to enforce exact bytes, while the patch suite executes the actual
artifacts behaviorally.

An upgrade should, at minimum:

1. update the manifest version/range and inspect the resolved package versions;
2. rebase or replace the patches against the new upstream artifacts and review
   the expected hashes centrally in `scripts/postinstall-lexical-patch.cjs`;
3. run postinstall to verify the intentionally updated hashes against every
   artifact;
4. rerun the direct artifact guards, DOM cache lifecycle, hydration,
   reconnect, Yjs snapshot, identity, and undo suites; and
5. review every callsite in the inventory for changed field shapes or event
   ordering before publishing.

## Collaborative Agent migration note

`CollaborativeAgentEditor.connect()` is single-flight. A rejected `connect()`
call—whether the initial connect or an explicit call waiting for a re-sync—
terminalizes and tears down that facade, cancelling provider reconnect work.
Passive transport auto-reconnect events do not by themselves terminalize a
facade. Callers must create a new facade with a fresh ticket after a rejected
connect; they must not retry the terminal instance. This is a public migration
note for consumers, not a claim that a release changelog entry has been
published.
