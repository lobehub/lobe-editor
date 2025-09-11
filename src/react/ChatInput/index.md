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

<code src="./demos/index.tsx" iframe nopadding></code>

## APIs

### ChatInput

| Property         | Description                                | Type                                                                       | Default |
| ---------------- | ------------------------------------------ | -------------------------------------------------------------------------- | ------- |
| children         | Main content area                          | `ReactNode`                                                                | -       |
| classNames       | Custom CSS class names for different areas | `{ body?: string; footer?: string; header?: string }`                      | -       |
| defaultHeight    | Default height of the input container      | `number`                                                                   | `64`    |
| footer           | Footer content                             | `ReactNode`                                                                | -       |
| fullscreen       | Enable fullscreen mode                     | `boolean`                                                                  | -       |
| header           | Header content                             | `ReactNode`                                                                | -       |
| height           | Controlled height of the input container   | `number`                                                                   | -       |
| maxHeight        | Maximum height of the input container      | `number`                                                                   | `320`   |
| minHeight        | Minimum height of the input container      | `number`                                                                   | `64`    |
| onSizeChange     | Callback when height changes               | `(height: number) => void`                                                 | -       |
| onSizeDragging   | Callback during height dragging            | `(height: number) => void`                                                 | -       |
| resize           | Enable resize functionality                | `boolean`                                                                  | `true`  |
| showResizeHandle | Show visual resize handle                  | `boolean`                                                                  | -       |
| slashMenuRef     | Reference for slash menu positioning       | `Ref<HTMLDivElement>`                                                      | -       |
| styles           | Custom inline styles for different areas   | `{ body?: CSSProperties; footer?: CSSProperties; header?: CSSProperties }` | -       |
