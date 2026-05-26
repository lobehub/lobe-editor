---
nav: Plugins
group: Plugins
title: Content Blocks
description: Content Blocks plugin extracts the current editor state into discrete content blocks (text / image / file) suitable for downstream AI chat pipelines. It mirrors the message-part format used by lobe-chat's context engine and ships a small helper to derive `imageList` / `fileList` arrays from the blocks.
---

## Introduction

`ContentBlocksPlugin` is a write-only utility plugin. It does not render anything in the editor; it observes the current Lexical state and produces a structured representation that AI chat backends can consume.

The plugin requires `MarkdownPlugin` to be registered first, since text serialization reuses the markdown writer.

## Playground

Edit the editor below and watch the extracted `ContentBlock[]` and derived `imageList` / `fileList` update live.

<code src="./demos/index.tsx"></code>

## Quick Start

### Register

```ts
import Editor from '@lobehub/editor';
import {
  CommonPlugin,
  ContentBlocksPlugin,
  FilePlugin,
  ImagePlugin,
  MarkdownPlugin,
} from '@lobehub/editor/plugins';

const kernel = Editor.createEditor().registerPlugins([
  CommonPlugin,
  MarkdownPlugin,
  [ImagePlugin, { renderImage: () => null }],
  [FilePlugin, { decorator: () => null, handleUpload }],
  ContentBlocksPlugin,
]);
kernel.initNodeEditor();
```

### Extract blocks

```ts
import type { ContentBlock } from '@lobehub/editor/plugins';

const blocks = kernel.getDocument('content-blocks') as ContentBlock[];
```

The `content-blocks` data source is write-only — `kernel.setDocument('content-blocks', ...)` is not supported.

### Derive imageList / fileList from blocks

```ts
import { extractMediaLists } from '@lobehub/editor/plugins';

const { imageList, fileList } = extractMediaLists(blocks);
```

`extractMediaLists` is a pure transformation over `ContentBlock[]` — no editor or service required. It scans the blocks once, ignores `text` parts, and produces the two media arrays in document order with fresh ids per entry.

## Headless Usage

`ContentBlocksPlugin` works without any DOM — pair it with the headless editor to extract blocks from a persisted editor state (typically server-side or inside a worker).

```ts
import {
  CONTENT_BLOCKS_DATA_TYPE,
  type ContentBlock,
  ContentBlocksPlugin,
  FilePlugin,
  ImagePlugin,
} from '@lobehub/editor';
import { DEFAULT_HEADLESS_EDITOR_PLUGINS, createHeadlessEditor } from '@lobehub/editor/headless';

const headless = createHeadlessEditor({
  additionalPlugins: [
    [ImagePlugin, { renderImage: () => null, handleUpload: async () => ({ url: '' }) }],
    [FilePlugin, { decorator: () => null, handleUpload: async () => ({ url: '' }) }],
    ContentBlocksPlugin,
  ],
  plugins: DEFAULT_HEADLESS_EDITOR_PLUGINS,
});

headless.hydrate({ content: editorJson, type: 'json' });
const blocks = headless.kernel.getDocument(CONTENT_BLOCKS_DATA_TYPE) as unknown as ContentBlock[];
headless.destroy();
```

`ImagePlugin` and `FilePlugin` are registered with no-op render / upload callbacks because the headless editor never touches the DOM. `MarkdownPlugin` is already part of `DEFAULT_HEADLESS_EDITOR_PLUGINS`, satisfying the markdown-writer dependency.

Edit the JSON input below and watch the headless extraction run live:

<code src="./demos/headless.tsx"></code>

## ContentBlock Schema

```ts
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; alt: string; width?: number; height?: number }
  | { type: 'file'; url: string; name: string; size?: number };
```

- Text parts hold markdown serialized from the surrounding text run.
- Image and file parts are emitted **only** when the underlying node's status is `uploaded`. Non-uploaded nodes become text placeholders (configurable — see [Plugin Options](#plugin-options)).
- `width` / `height` are omitted when the image stores `'inherit'` or `0`.
- Adjacent text parts are merged with `\n\n` separators after extraction.

## Extraction Behavior

### Node-to-block mapping

| Lexical node type                             | Emitted as                               |
| --------------------------------------------- | ---------------------------------------- |
| `image` (inline)                              | Image block (lifted out of its parent)   |
| `block-image`                                 | Image block                              |
| `file`                                        | File block                               |
| `paragraph` / `heading` / `quote` (text-only) | Part of a text block                     |
| Other elements (list, table, code, …)         | Serialized as markdown into a text block |

### Container splitting

Paragraphs, headings, and quotes that contain inline images are **split** around each image:

```text
Paragraph [ "before " <image src=A> " after" ]
  →  text("before") + image(A) + text("after")
```

Non-splittable containers (lists, tables, code blocks) keep their inline images inline — the markdown writer renders them as `![alt](src)` within the text block.

### Root-level atomics

Image and file nodes placed directly under the editor root are always emitted as standalone blocks, regardless of any `isInline()` declaration on the node class.

### Upload status & placeholders

For an image or file that is not yet `uploaded`, the default behavior is to flush a textual placeholder into the surrounding text block:

| Status    | Placeholder                                                            |
| --------- | ---------------------------------------------------------------------- |
| `loading` | `[image uploading...]`                                                 |
| `pending` | `[file uploading: <name>]`                                             |
| `error`   | `[image upload failed: <msg>]` / `[file upload failed: <name>: <msg>]` |

Setting `emitPlaceholderForUnuploaded: false` drops the node silently. Surrounding text on both sides will then merge into a single text block.

### Text-block merging

After all nodes are visited, adjacent text blocks are concatenated with `\n\n`. This keeps `imageList` / `fileList` accurate when derived later, while preventing fragmented text output.

## Direct API

The plugin's logic is also exposed as plain functions for callers that already hold a `LexicalEditor` reference.

### `extractContentBlocks`

```ts
import {
  type ContentBlock,
  type ExtractContentBlocksOptions,
  extractContentBlocks,
} from '@lobehub/editor/plugins';
import { IMarkdownShortCutService } from '@lobehub/editor/plugins/markdown/service/shortcut';

const editor = kernel.getLexicalEditor()!;
const service = kernel.requireService(IMarkdownShortCutService)!;

const blocks: ContentBlock[] = extractContentBlocks(editor, service, {
  emitPlaceholderForUnuploaded: false,
});
```

### `extractMediaLists`

```ts
import { type MediaLists, extractMediaLists } from '@lobehub/editor/plugins';

const { imageList, fileList }: MediaLists = extractMediaLists(blocks);
```

Returns:

| Field       | Description                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------- |
| `imageList` | `{ id, alt, url }[]` — one entry per image block, in document order.                         |
| `fileList`  | `{ id, name, size, fileType, url }[]` — one entry per file block. `fileType` from extension. |

## Plugin Options

### `ContentBlocksPluginOptions`

| Property         | Description                                                                                                                                                             | Type                          | Default |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------- |
| `defaultOptions` | Default `ExtractContentBlocksOptions` applied when reading via `kernel.getDocument('content-blocks')`. Direct callers of `extractContentBlocks` pass their own options. | `ExtractContentBlocksOptions` | `{}`    |

### `ExtractContentBlocksOptions`

| Property                       | Description                                                                                      | Type      | Default |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | --------- | ------- |
| `emitPlaceholderForUnuploaded` | When `true`, non-uploaded images/files become text placeholders. When `false`, dropped silently. | `boolean` | `true`  |

### Example: silent drop

```ts
const kernel = Editor.createEditor().registerPlugins([
  CommonPlugin,
  MarkdownPlugin,
  ImagePlugin,
  FilePlugin,
  [ContentBlocksPlugin, { defaultOptions: { emitPlaceholderForUnuploaded: false } }],
]);
```

## Type Reference

```ts
export const CONTENT_BLOCKS_DATA_TYPE = 'content-blocks';

export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface ImageContentBlock {
  type: 'image';
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface FileContentBlock {
  type: 'file';
  url: string;
  name: string;
  size?: number;
}

export type ContentBlock = TextContentBlock | ImageContentBlock | FileContentBlock;

export interface ImageListItem {
  id: string;
  alt: string;
  url: string;
}

export interface FileListItem {
  id: string;
  name: string;
  size: number;
  fileType: string;
  url: string;
}

export interface MediaLists {
  imageList: ImageListItem[];
  fileList: FileListItem[];
}

export interface ExtractContentBlocksOptions {
  emitPlaceholderForUnuploaded?: boolean;
}
```

## Notes

- The plugin only writes; it does not introduce nodes, decorators, or commands into the editor.
- `MarkdownPlugin` must be registered before `ContentBlocksPlugin`. If absent, a warning is logged on init and `kernel.getDocument('content-blocks')` throws.
- Image and file detection relies on the standard node types `image`, `block-image`, and `file` shipped with `ImagePlugin` / `FilePlugin`. Custom atomic node types are not currently recognized.
