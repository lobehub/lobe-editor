# Table Horizontal Bleed (Scrollable Layout)

## Summary

Let the table scroll wrapper extend its right edge past the editor's text content area into the editor's own inline padding. Narrow tables look unchanged. Wide tables gain one anchor-padding's worth of additional visible width before scrolling, and visually bleed into the right gutter as the user scrolls — matching the layout convention seen in Notion / Linear style editors.

## Motivation

Editors usually have a max-width with inline gutters on either side. For wide content like tables, those gutters are wasted: the table is forced to scroll inside the narrower text column. The existing `ReactTablePlugin` wraps each table in `.lobe-editor-table-scroll-wrapper` (`overflow: auto visible`) and clips horizontal scroll at the editor's content width.

Anchoring the table's left edge to the text column but allowing its right edge to bleed into the editor's anchor-padding gutter:

- gives the user more visible columns before scrolling kicks in,
- keeps the table visually tied to the paragraph text on the left,
- requires no new APIs and no JS measurement.

## Scope

In:

- Extend `.lobe-editor-table-scroll-wrapper`'s right boundary by the editor's anchor padding via CSS only.
- Add a dumi demo (`scrollable.tsx` + `scrollable.json`) that demonstrates the behavior with a wide table sandwiched between paragraphs.
- Document the demo in `src/plugins/table/index.md` under a new "Horizontal Scrolling" section.

Out:

- No new plugin options, no API surface additions.
- No sticky first column, no sticky header row.
- No JS measurement, ResizeObserver, or runtime width detection.
- No symmetric bleed (left edge stays anchored to text).
- No fix for the pre-existing `.lobe-editor-table-scroll-indicator-end` `inset-inline-start: 0` issue; tracked separately.

## Decided UI behavior

- **Bleed direction**: right only. Left edge of the wrapper continues to align with the text column.
- **Bleed extent**: `var(--lobe-block-anchor-padding, 54px)`. Whatever the block plugin's anchor padding resolves to (via its existing plugin option or CSS variable), the table bleed matches. Consumers that override the anchor padding to `0` (e.g., PageEditor in lobe-chat) get bleed `0` automatically — no separate coordination point.
- **Activation**: always on. The wrapper is block-level and the table inside has `width: fit-content`. For narrow tables, the extra wrapper width on the right is empty space that visually coincides with the editor's own padding zone, so there is no perceived visual change.
- **Direction-awareness**: implemented with `margin-inline-end`, so RTL layouts mirror automatically.

## Architecture / file changes

| File                                            | Change                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/plugins/table/react/style.ts`              | Add `margin-inline-end: calc(var(--lobe-block-anchor-padding, 54px) * -1);` to the `.lobe-editor-table-scroll-wrapper` rule. |
| `src/plugins/table/demos/scrollable.tsx` (new)  | `ReactEditor` + `ReactPlainText` + `ReactTablePlugin`, loads `scrollable.json`.                                              |
| `src/plugins/table/demos/scrollable.json` (new) | Lexical serialized state: lead paragraphs, one wide table (≈10 columns), trailing paragraph.                                 |
| `src/plugins/table/index.md`                    | New "Horizontal Scrolling" section embedding the new demo.                                                                   |

Files explicitly unchanged: `plugin/index.ts`, `node/index.ts`, `react/index.tsx`, `command/index.ts`, every `service/*`, every `utils/*`. No plugin lifecycle, command, or service surface is touched.

## Demo data shape

`scrollable.json` is a Lexical serialized editor state containing:

- 1–2 lead paragraphs describing the demo intent.
- One table with ≈10 columns. Suggested headers: `ID`, `Name`, `Status`, `Owner`, `Region`, `Created`, `Last seen`, `Tags`, `Latency`, `Notes`. 5–8 rows of plausible content. Column widths chosen so the natural table width exceeds the editor's content width at typical viewports, forcing the scroll affordance to engage.
- 1 trailing paragraph confirming the text column reflows back to the anchored width below the table.

## Edge cases

- **Narrow tables** (natural width ≤ content width): wrapper renders as today; no scrollbar, no visible difference.
- **Consumer overrides `--lobe-block-anchor-padding`**: bleed amount follows. `0` disables bleed entirely without any plugin changes.
- **Mobile / narrow viewports** where anchor padding is small: bleed shrinks accordingly. CSS-only, no JS branching.
- **SSR**: nothing dynamic; rendered identically server-side.
- **RTL**: `margin-inline-end` flips automatically.
- **Ancestor with `overflow: hidden`** at the editor's outer edge: bleed is visually clipped. Acceptable; consumer concern, not plugin concern.

## Verification

- Run dumi (`pnpm start`), open the table plugin page, scroll to the new "Horizontal Scrolling" demo. Confirm the wide table's right edge extends past the paragraph text into the right gutter, and that scrolling reveals additional columns smoothly without disturbing the surrounding paragraphs.
- Confirm the existing demo (`demos/index.tsx`) still renders unchanged.
- No unit tests added — change is pure presentational CSS. Existing table test suite is expected to continue passing without modification.

## Risks

- A consumer that wraps the editor in a container clipping at the editor's outer edge (e.g., `overflow: hidden` on the editor root) will see the bleed clipped. Note this in the demo's introduction.
- Pre-existing positioning quirk in `.lobe-editor-table-scroll-indicator-end` may be slightly more visible with the wider wrapper. Out of scope here; track as a separate follow-up.
