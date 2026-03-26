---
nav: Components
group: Renderer
title: LexicalDiff
description: Read-only side-by-side diff viewer for SerializedEditorState values.
atomId: LexicalDiff
apiHeader:
  pkg: '@lobehub/editor/renderer'
  docUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/renderer/LexicalDiff/index.md'
  sourceUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/renderer/LexicalDiff.tsx'
---

## Introduction

`LexicalDiff` compares two `SerializedEditorState` values and renders a read-only side-by-side diff view. It uses the existing headless `LexicalRenderer` for default block rendering and adds block-level renderer extension points for custom diff UIs.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Custom Block Renderer

Use `blockRenderers[type]` for same-type rows and `renderBlockDiff` for cross-type fallback rows.

<code src="./demos/renderers.tsx"></code>

## Complex Document Diff

Mixed block types (heading, paragraph, list, quote, code) with insert, delete, modify, and cross-type changes.

<code src="./demos/complex-document.tsx"></code>

## Inline Text Modifications

Character-level diff highlighting within paragraphs. Multiple insert/delete spans in a single block.

<code src="./demos/inline-modifications.tsx"></code>

## List Diff

Bullet/number list with items added, removed, modified, and list type changes.

<code src="./demos/list-diff.tsx"></code>

## Features

- Root-block alignment with one diff row per aligned block pair
- Character-level text highlighting for inline modifications
- Reuses `LexicalRenderer` so existing block nodes render out of the box
- Supports `blockRenderers[type]` plus `renderBlockDiff` fallback for custom block comparison UIs
