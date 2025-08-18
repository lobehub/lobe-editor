---
nav: Components
group:
  title: Playground
  order: -1
title: Editor
description: Editor is a comprehensive rich text editor component built on a powerful editor kernel. It supports plugins, mentions, slash commands, and various content formats with extensive customization options for modern editing experiences.
apiHeader:
  pkg: '@lobehub/editor/react'
  docUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/react/Editor/index.md'
  sourceUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/react/Editor/index.ts'
---

## Introduction

Editor is a powerful and extensible rich text editor component designed for modern applications. Built on a robust editor kernel, it supports a wide range of features including plugin architecture, mention functionality, slash commands, and multiple content formats. The editor provides both plain text and rich text editing capabilities with comprehensive customization options.

## Basic Usage

<code src="./demos/index.tsx" nopadding iframe></code>

## APIs

### Editor

| Property      | Description                             | Type                                 | Default |
| ------------- | --------------------------------------- | ------------------------------------ | ------- |
| children      | Additional content or components        | `ReactNode`                          | -       |
| className     | Custom CSS class                        | `string`                             | -       |
| content       | Initial editor content                  | `ReactEditorContentProps['content']` | -       |
| editorRef     | Reference to the editor instance        | `Ref<IEditor>`                       | -       |
| mentionOption | Configuration for mention functionality | `MentionOption`                      | `{}`    |
| onChange      | Change event handler                    | `(editor: IEditor) => void`          | -       |
| placeholder   | Placeholder content                     | `ReactNode`                          | -       |
| plugins       | Array of editor plugins                 | `EditorPlugin[]`                     | `[]`    |
| slashOption   | Configuration for slash commands        | `Partial<ReactSlashOptionProps>`     | `{}`    |
| style         | Custom inline styles                    | `CSSProperties`                      | -       |
| theme         | Editor theme                            | `ReactPlainTextProps['theme']`       | -       |
| variant       | Editor variant style                    | `ReactPlainTextProps['variant']`     | -       |

### EditorPlugin

Editor plugins can be defined in two formats:

```typescript
type EditorPlugin = FC<any> | [FC<any>, Record<string, any>];
```

### MentionOption

| Property       | Description                     | Type                                        | Default |
| -------------- | ------------------------------- | ------------------------------------------- | ------- |
| items          | Available mention items         | `ReactSlashOptionProps['items']`            | -       |
| markdownWriter | Custom markdown writer function | `ReactMentionPluginProps['markdownWriter']` | -       |

### Static Methods

The Editor component also provides static methods:

- `Editor.useEditor`: Hook for accessing editor functionality
- `Editor.withProps`: Higher-order component for prop injection
