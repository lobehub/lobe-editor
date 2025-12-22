---
nav: Components
group: General
title: SendButton
---

## Introduction

SendButton is a powerful button component designed specifically for message sending interfaces. It supports various states including loading, generating, and provides dropdown menu functionality for additional actions. The component automatically switches between send and stop icons based on the current state.

## Basic Usage

<code src="./demos/index.tsx" nopadding center></code>

## APIs

### SendButton

| Property   | Description                          | Type                             | Default     |
| ---------- | ------------------------------------ | -------------------------------- | ----------- |
| generating | Show generating state with stop icon | `boolean`                        | `false`     |
| shape      | Button shape style                   | `'default' \| 'round'`           | `'default'` |
| size       | Button size                          | `number`                         | `32`        |
| menu       | Dropdown menu configuration          | `DropdownButtonProps['menu']`    | -           |
| loading    | Show loading state                   | `boolean`                        | `false`     |
| type       | Button type                          | `DropdownButtonProps['type']`    | `'primary'` |
| className  | Custom CSS class                     | `string`                         | -           |
| style      | Custom inline styles                 | `CSSProperties`                  | -           |
| onClick    | Click event handler                  | `DropdownButtonProps['onClick']` | -           |

Note: This component extends Ant Design's DropdownButton component and inherits all its properties except `children`, `icon`, and `size`.
