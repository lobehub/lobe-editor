---
nav: Components
group: Data Entry
title: ChatInput
description: ChatInput is a flexible container component for building chat input interfaces. It provides structured layout with header, footer, and content areas, along with configurable height constraints and slash menu integration.
apiHeader:
  pkg: '@lobehub/editor/react'
  docUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/react/ChatInput/index.md'
  sourceUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/react/ChatInput/index.ts'
---

## Introduction

ChatInput is a versatile container component designed for chat input interfaces. It provides a structured layout with customizable header and footer sections, automatic height management, and integration with slash menu functionality. The component is built with flexibility in mind to accommodate various chat interface designs.

## Basic Usage

<code src="./demos/index.tsx" iframe></code>

## APIs

### ChatInput

| Property     | Description                           | Type                  | Default              |
| ------------ | ------------------------------------- | --------------------- | -------------------- |
| children     | Main content area                     | `ReactNode`           | -                    |
| className    | Custom CSS class                      | `string`              | -                    |
| footer       | Footer content                        | `ReactNode`           | -                    |
| header       | Header content                        | `ReactNode`           | -                    |
| maxHeight    | Maximum height of the input container | `string \| number`    | `'min(50vh, 640px)'` |
| slashMenuRef | Reference for slash menu positioning  | `Ref<HTMLDivElement>` | -                    |
| style        | Custom inline styles                  | `CSSProperties`       | -                    |
