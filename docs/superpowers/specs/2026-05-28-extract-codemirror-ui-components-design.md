# Extract CodeMirror UI Components as a Reusable Subpath Export

## Goal

Extract the UI parts of the in-tree CodeMirror code-block (toolbar, language picker, more-options popover, copy button, theme, styles) from `src/plugins/codemirror-block/` into a Lexical-agnostic subpath export of the main package, so downstream consumers can compose their own code-block UI without depending on the Lexical plugin layer.

## Scope

In-scope (component-level extraction, "option C"):

- UI components: `Toolbar`, `LanguageSelect`, `MoreOptions`, `CopyButton`.
- Styles: `style.ts` (Block-level static styles) and the component-local `style.ts` (LanguageSelect width).
- Theme: `lobeTheme` (CodeMirror theme token map).
- Language data: `MODES` exported as `LANGUAGES` plus a `CodeMirrorMode` type.

Out-of-scope:

- The CDN loader (`loadCodeMirror`) and its types — not part of this extraction.
- A `useCodeMirror` hook wrapping textarea lifecycle — not extracted; the Lexical-coupled `CodemirrorNode.tsx` keeps owning that.
- Any change to `@lobehub/codemirror` (the bundled CDN package).

## Distribution

- Add a new entry `src/codemirror/index.ts`.
- Add `tsdown` entry `codemirror: 'src/codemirror/index.ts'` in the browser-platform group (same group as `index` / `react` / `renderer`).
- Add `package.json#exports`:
  ```json
  "./codemirror": {
    "types": "./es/codemirror.d.ts",
    "import": "./es/codemirror.js"
  }
  ```
- Downstream usage:
  ```ts
  import {
    type CodeMirrorLabels,
    CopyButton,
    LANGUAGES,
    LanguageSelect,
    MoreOptions,
    Toolbar,
    lobeTheme,
  } from '@lobehub/editor/codemirror';
  ```

## Target Layout

```
src/codemirror/
  index.ts            # public surface
  components/
    Toolbar.tsx
    LanguageSelect.tsx
    MoreOptions.tsx
    CopyButton.tsx
    style.ts          # LanguageSelect-local styles (min-width)
  style.ts            # Block-level styles (was react/style.ts)
  theme.ts            # lobeTheme
  constants.ts        # LANGUAGES (data moved from lib/mode.ts)
  types.ts            # CodeMirrorMode, CodeMirrorLabels, component Props types
```

Source files at the old locations are **deleted, not duplicated**:

- `src/plugins/codemirror-block/react/components/*` → moved to `src/codemirror/components/`
- `src/plugins/codemirror-block/react/style.ts` → moved to `src/codemirror/style.ts`
- `src/plugins/codemirror-block/react/theme.ts` → moved to `src/codemirror/theme.ts`
- `src/plugins/codemirror-block/lib/mode.ts` → data moved to `src/codemirror/constants.ts` (re-exported by the old path if any other file still imports `MODES`, otherwise removed)

`src/plugins/codemirror-block/react/CodemirrorNode.tsx` is updated to import from `@/codemirror` and to build a `labels` object from `useTranslation()` (see "Lexical Adapter" below).

## API

### Types (`types.ts`)

```ts
export interface CodeMirrorMode {
  value: string; // mode id, e.g. 'javascript'
  name: string; // display name, e.g. 'JavaScript'
  syntax: string; // CodeMirror syntax key
  ext?: string[]; // file extensions for matching/filtering
}

export interface CodeMirrorLabels {
  copy?: string; // default: 'Copy'
  selectLanguage?: string; // default: 'Select language'
  tabSize?: string; // default: 'Tab size'
  useTabs?: string; // default: 'Use tabs'
  showLineNumbers?: string; // default: 'Show line numbers'
}
```

### `CopyButton`

```ts
interface CopyButtonProps {
  onCopy: () => void;
  labels?: Pick<CodeMirrorLabels, 'copy'>;
  className?: string;
}
```

Change vs. current: previously `default export`, now **named export**. The component itself currently has no error handling — the `message.error('codemirror.copyFailed')` toast lives in `CodemirrorNode.tsx`'s `handleCopy` and is removed there (see "Lexical Adapter" below). Downstream consumers can wrap their own `onCopy` callback to surface failures however they want.

### `LanguageSelect`

```ts
interface LanguageSelectProps {
  selectedLang: string;
  onLanguageChange: (value: string) => void;
  options?: CodeMirrorMode[]; // default: built-in LANGUAGES
  labels?: Pick<CodeMirrorLabels, 'selectLanguage'>;
  className?: string;
}
```

Filtering rule (unchanged from current behavior): match by value-prefix, name-substring, or any ext-prefix.

### `MoreOptions`

```ts
interface MoreOptionsProps {
  tabSize: number;
  onTabSizeChange: (value: number | null) => void;
  useTabs: boolean;
  onUseTabsChange: (checked: boolean) => void;
  showLineNumbers: boolean;
  onShowLineNumbersChange: (checked: boolean) => void;
  labels?: Pick<CodeMirrorLabels, 'tabSize' | 'useTabs' | 'showLineNumbers'>;
}
```

### `Toolbar`

```ts
interface ToolbarProps {
  selectedLang: string;
  onLanguageChange: (value: string) => void;
  onCopy: () => void;
  tabSize: number;
  onTabSizeChange: (value: number | null) => void;
  useTabs: boolean;
  onUseTabsChange: (checked: boolean) => void;
  showLineNumbers: boolean;
  onShowLineNumbersChange: (checked: boolean) => void;
  expand?: boolean;
  onClick?: () => void;
  toggleExpand?: () => void;
  labels?: CodeMirrorLabels; // forwarded to children
  languageOptions?: CodeMirrorMode[]; // forwarded to LanguageSelect
}
```

`labels` is a single optional object on `Toolbar` that internally fans out the relevant `Pick<…>` to each child. Each leaf component still accepts its own `labels` prop so it can be used standalone.

### `index.ts` surface

```ts
export { Toolbar } from './components/Toolbar';
export { LanguageSelect } from './components/LanguageSelect';
export { MoreOptions } from './components/MoreOptions';
export { CopyButton } from './components/CopyButton';
export { lobeTheme } from './theme';
export { LANGUAGES } from './constants';
export type { CodeMirrorMode, CodeMirrorLabels } from './types';
export type { ToolbarProps, LanguageSelectProps, MoreOptionsProps, CopyButtonProps } from './types';
```

## i18n

The new components have **no** dependency on `@/editor-kernel/react/useTranslation`. All user-visible strings come from `labels` props with English defaults baked in. Resolution per component is:

```ts
const text = labels?.copy ?? 'Copy';
```

No Context, no provider — keeps the surface explicit per the chosen approach.

## Lexical Adapter (in-tree consumer)

`src/plugins/codemirror-block/react/CodemirrorNode.tsx` is rewired to consume the new subpath. Conceptually:

```ts
import { Toolbar, lobeTheme, styles } from '@/codemirror';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

const t = useTranslation();
const labels = {
  copy: t('codemirror.copy'),
  selectLanguage: t('codemirror.selectLanguage'),
  tabSize: t('codemirror.tabSize'),
  useTabs: t('codemirror.useTabs'),
  showLineNumbers: t('codemirror.showLineNumbers'),
};

return (
  <Block ...>
    <Toolbar labels={labels} ... />
    ...
  </Block>
);
```

`handleCopy` keeps writing to `navigator.clipboard` but the `catch` branch becomes a silent no-op — the `message.error` call and the `antd` `message` import are removed from `CodemirrorNode.tsx`. The previous `t('codemirror.copyFailed')` translation key becomes unreferenced and will be removed from `src/locale/*` files as part of this change.

## External Dependencies

The extracted module continues to use:

- `@lobehub/ui` (peer): `ActionIcon`, `Flexbox`, `InputNumber`, `MaterialFileTypeIcon`, `Popover`, `Select`, `Text`.
- `antd` (peer): `Switch`.
- `antd-style` (dep): `createStaticStyles`, `cssVar`, `cx`.
- `lucide-react` (dep): `Check`, `ChevronDown`, `ChevronRight`, `CopyIcon`, `MoreHorizontalIcon`.

Removed:

- `antd`'s `message` (was used by `CodemirrorNode.tsx`'s now-silent copy-failure path; the `import { message } from 'antd'` line goes away).
- `@/editor-kernel/react/useTranslation` (removed from the extracted components; the Lexical adapter still uses it locally to build a `labels` object).

## Testing

No new unit tests in this change — components are pure UI with prop-passing behavior already exercised by the existing dumi demo and the Lexical plugin integration. Verification steps:

1. `pnpm type-check` — the relocated imports must resolve and the new `./codemirror` types must build.
2. `pnpm build` — confirm `es/codemirror.js` and `es/codemirror.d.ts` are produced.
3. `pnpm lint` — scoped to changed files.
4. Manual: run the existing codemirror demo under `dumi dev`, confirm toolbar / language picker / copy / more-options all still work, including the Lexical-driven focus/blur and selection effects.

## Migration / Compatibility

- The Lexical plugin's public surface (`@lobehub/editor` root export) is unchanged. The existing `ReactCodemirrorPlugin` and command exports stay where they are.
- The new `./codemirror` subpath is additive — no existing import path breaks.
- The old physical files under `src/plugins/codemirror-block/react/components/`, `react/style.ts`, `react/theme.ts` are deleted; only `src/plugins/codemirror-block/` itself imports from them today, and that consumer is updated in this change.
- `lib/mode.ts` is reduced to a re-export of `LANGUAGES` from `@/codemirror/constants` if any internal file still imports `MODES`; otherwise the file is deleted. (Check at implementation time with a workspace grep for `MODES`.)
