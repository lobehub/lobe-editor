---
nav: Components
group: Layout
title: ChatInputActionBar
description: ChatInputActionBar is a horizontal layout component for organizing actions in chat input interfaces. It provides left and right alignment areas with consistent spacing and styling, ideal for toolbar-like action arrangements.
apiHeader:
  pkg: '@lobehub/editor/react'
  docUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/react/ChatInputActionBar/index.md'
  sourceUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/react/ChatInputActionBar/index.ts'
---

## Introduction

ChatInputActionBar is a layout component designed for organizing actions and controls in chat input interfaces. It provides a clean horizontal layout with designated left and right areas, automatically handling spacing and alignment. This component is perfect for creating toolbars, action bars, and similar UI elements.

## Basic Usage

<code src="./demos/index.tsx" center></code>

## APIs

### ChatInputActionBar

| Property  | Description            | Type            | Default |
| --------- | ---------------------- | --------------- | ------- |
| className | Custom CSS class       | `string`        | -       |
| left      | Content for left area  | `ReactNode`     | -       |
| right     | Content for right area | `ReactNode`     | -       |
| style     | Custom inline styles   | `CSSProperties` | -       |
