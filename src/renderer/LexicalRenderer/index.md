---
nav: Components
group: Renderer
title: LexicalRenderer
description: Headless renderer that converts SerializedEditorState JSON to React elements without loading a full editor instance. SSR/SSG safe, with dedicated Mermaid code-block rendering support.
atomId: LexicalRenderer
apiHeader:
  pkg: '@lobehub/editor/renderer'
  docUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/renderer/LexicalRenderer/index.md'
  sourceUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/renderer/LexicalRenderer.tsx'
---

## Introduction

`LexicalRenderer` is a lightweight, headless component that renders Lexical editor state (JSON) as static React elements. It uses `@lexical/headless` to parse the state and a custom renderer registry to produce server-safe HTML — no full editor, plugins, or DOM binding required.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Comparison with Editor

Side-by-side comparison between `<Editor editable={false}>` and `<LexicalRenderer>` using the same JSON data.

<code src="./demos/compare.tsx"></code>

## Features

- Pure JSON → React conversion with `useMemo` caching
- SSR/SSG compatible (no browser APIs required)
- Built-in renderers for all core node types: paragraph, heading, quote, list, link, table, image, math, code block (including Mermaid), mention, file, horizontal rule
- Override system for custom node rendering
- URL sanitization for links
- Automatic heading slug generation
