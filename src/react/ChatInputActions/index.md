---
nav: Components
group: General
title: ChatInputActions
description: ChatInputActions is a sophisticated action management component for chat interfaces. It supports multiple action types including regular actions, dropdowns, collapsible sections, and automatic overflow handling with smart responsive behavior.
apiHeader:
  pkg: '@lobehub/editor/react'
  docUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/react/ChatInputActions/index.md'
  sourceUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/react/ChatInputActions/index.ts'
---

## Introduction

ChatInputActions is a comprehensive action management component designed for chat input interfaces. It provides intelligent handling of multiple action types including buttons, dropdown menus, collapsible sections, and dividers. The component features automatic overflow management that responsively adapts to container size and provides collapsible behavior when space is limited.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Collapse

The component supports collapsible sections for organizing related actions:

<code src="./demos/Collapse.tsx"></code>

## APIs

### ChatInputActions

| Property      | Description                | Type                                     | Default |
| ------------- | -------------------------- | ---------------------------------------- | ------- |
| disabled      | Disable all actions        | `boolean`                                | `false` |
| items         | Array of action items      | `ChatInputActionItem[]`                  | `[]`    |
| onActionClick | Action click event handler | `(action: ChatInputActionEvent) => void` | -       |
| className     | Custom CSS class           | `string`                                 | -       |
| gap           | Gap between action items   | `FlexboxProps['gap']`                    | `2`     |

### ChatInputActionItem

The component supports multiple types of action items:

#### ActionItem

| Property      | Description                    | Type                                         | Default |
| ------------- | ------------------------------ | -------------------------------------------- | ------- |
| key           | Unique identifier              | `string`                                     | -       |
| icon          | Action icon                    | `ReactNode`                                  | -       |
| label         | Action label                   | `ReactNode`                                  | -       |
| active        | Show active state              | `boolean`                                    | `false` |
| alwaysDisplay | Always display (no collapsing) | `boolean`                                    | `false` |
| children      | Custom content                 | `ReactNode`                                  | -       |
| wrapper       | Custom wrapper function        | `(dom: ReactNode, key: string) => ReactNode` | -       |

#### CollapseItem

| Property      | Description                 | Type                            | Default |
| ------------- | --------------------------- | ------------------------------- | ------- |
| type          | Item type                   | `'collapse'`                    | -       |
| children      | Collapsible action items    | `(ActionItem \| DividerItem)[]` | -       |
| defaultExpand | Default expand state        | `boolean`                       | `false` |
| expand        | Controlled expand state     | `boolean`                       | -       |
| onChange      | Expand state change handler | `(expand: boolean) => void`     | -       |

#### DropdownItem

| Property | Description         | Type             | Default |
| -------- | ------------------- | ---------------- | ------- |
| type     | Item type           | `'dropdown'`     | -       |
| children | Dropdown menu items | `MenuItemType[]` | -       |

#### DividerItem

| Property | Description | Type        | Default |
| -------- | ----------- | ----------- | ------- |
| type     | Item type   | `'divider'` | -       |

### ChatInputActionEvent

| Property | Description        | Type               |
| -------- | ------------------ | ------------------ |
| key      | Action key         | `string`           |
| keyPath  | Action key path    | `string[]`         |
| domEvent | Original DOM event | `React.MouseEvent` |
