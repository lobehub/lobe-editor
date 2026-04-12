# Diff View Borderless UI Style

## Overview

Add a `borderless` appearance variant to `LexicalDiff`, controlled via a new `appearance` prop. Refactor `style.ts` to extract shared styles and provide two complete style sets.

## API

```ts
interface LexicalDiffProps {
  // ... existing props
  appearance?: 'default' | 'borderless'; // default: 'default'
}
```

`appearance` is distinct from the existing `variant` prop (which controls `LexicalRenderer` rendering style: `'default' | 'chat'`).

## Visual Spec

### Default appearance (unchanged)

- Root: `1px solid colorBorderSecondary`, `borderRadiusSM`
- Header: `colorFillQuaternary` background, bottom border, column divider
- Rows: grid two-column, no gap, no row dividers
- Empty cell: `colorFillQuaternary`
- Diff cells: `colorError 10%` (delete), `colorSuccess 10%` (insert)

### Borderless appearance

- Root: no border, no border-radius (0)
- Header: no background, no border, labels remain as lightweight text (same font-size/weight/color/uppercase/letter-spacing)
- Columns: no vertical divider, 12px inline gap between columns
- Rows: zebra striping via `nth-child(odd)` with `colorFillQuaternary` background on the row
- Empty cell: `colorFillQuaternary` fill (overlays on zebra stripe)
- Diff cells: same `colorError 10%` / `colorSuccess 10%` colors (overlay on zebra)
- All border-radius: 0 throughout (root, rows, cells)

## Implementation: Dual Style Objects with Shared Base

### File: `src/renderer/diff/style.ts`

Refactor from one `styles` export to:

1. **`baseStyles`** — shared styles used by both appearances:
   - `body`: flex column layout
   - `cell`: overflow, min-width, min-height, child width
   - `deleteCell`: delete background color
   - `insertCell`: insert background color
   - `emptyCell`: quaternary fill
   - `row`: display grid, two-column template

2. **`defaultStyles`** — extends base with:
   - `root`: border, border-radius, background
   - `header`: grid layout, bottom border, quaternary background
   - `headerCell`: padding, font styling
   - `headerOld`: right border divider
   - `cellOld`: (empty, placeholder for specificity)

3. **`borderlessStyles`** — extends base with:
   - `root`: no border, no border-radius, background only
   - `header`: grid layout, no border, no background
   - `headerCell`: same font styling, no padding changes needed
   - `headerOld`: no right border
   - `row`: override to add column gap (12px)
   - `rowZebra`: `nth-child(odd)` background via parent selector on `body`
   - `cellOld`: (empty)

Export a function or map:

```ts
export const diffStyles = {
  default: { ...baseStyles, ...defaultOverrides },
  borderless: { ...baseStyles, ...borderlessOverrides },
};
```

Actual merge strategy: each key in `defaultOverrides`/`borderlessOverrides` uses `cx()` to compose `baseStyles[key]` + the override class. This way the consumer gets a flat `Record<string, string>` with the same keys regardless of appearance.

### File: `src/renderer/LexicalDiff.tsx`

- Add `appearance` to `LexicalDiffProps`, default `'default'`
- Replace `styles` import with `diffStyles[appearance]`
- Zebra striping: in borderless mode, apply the zebra class on `body` so `nth-child(odd)` targets `.row` children
- No other logic changes; `renderRow`, `RowCell`, block renderer pipeline remain identical

### Style Keys (unified interface)

Both style sets export the same keys:

```
root, header, headerCell, headerOld, body, row, cell, cellOld,
deleteCell, insertCell, emptyCell
```

Borderless adds zebra via a CSS rule on `body > .row:nth-child(odd)` pattern, not a separate key.

## Scope

- Files modified: `src/renderer/diff/style.ts`, `src/renderer/LexicalDiff.tsx`, `src/renderer/diff/types.ts` (optional: export appearance type)
- Files added: none
- No changes to `compute.ts`
- No changes to `LexicalRenderer` or its types
- Existing demos continue to work (default appearance)
- Add one demo showing borderless usage

## Testing

- Existing `LexicalDiff.test.tsx` should pass unchanged (default appearance)
- Add snapshot or render test for `appearance="borderless"` to confirm class differences
- Visual verification via demo page
