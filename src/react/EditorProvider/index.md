---
nav: React Components
group: Providers
title: EditorProvider
description: Global editor configuration provider that supports unified management of locale, themes, and other global settings. Uses React 19 standard Context API to provide consistent configuration for all editor instances.
atomId: EditorProvider
---

## Introduction

`EditorProvider` is a global configuration provider component designed to centrally manage all editor instance configurations at the application level. It supports locale injection, theme configuration, and other global settings, allowing you to configure all editor behaviors in one place.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Core Architecture

### Context Integration

The `EditorProvider` uses React 19's enhanced Context API with the `use()` hook to provide global configuration:

- **Global State Management**: Stores configuration in global object to avoid Context nesting issues
- **Automatic Injection**: Editor instances automatically detect and use global configuration
- **Nested Provider Support**: Inner providers override outer provider configurations

### Locale System

The provider supports nested locale structures that align with the project's locale files:

```ts
const locale = {
  file: {
    error: 'Upload failed: {{message}}',
    uploading: 'Uploading...',
  },
  table: {
    delete: 'Delete table',
    deleteColumn: 'Delete column',
  },
};
```

### Configuration Merging

- **Deep Merge**: Nested locale objects are deep-merged using lodash's merge function
- **Priority Order**: Component-level > Provider-level > Default locale
- **Type Safety**: Full TypeScript inference for nested locale structures

## Advanced Usage

### Complete Configuration Example

```ts
import { Editor, EditorProvider } from '@lobehub/editor/react';

const globalConfig = {
  theme: {
    primaryColor: '#1677ff',
    borderRadius: 6,
  },
  locale: {
    // File-related - supports nested structure
    file: {
      error: 'File upload failed: {{message}}',
      uploading: 'Uploading file...',
    },

    // Table-related
    table: {
      delete: 'Delete table',
      deleteColumn: 'Delete column',
      deleteRow: 'Delete row',
      insertColumnLeft: 'Insert {{count}} column(s) to the left',
      insertColumnRight: 'Insert {{count}} column(s) to the right',
      insertRowAbove: 'Insert {{count}} row(s) above',
      insertRowBelow: 'Insert {{count}} row(s) below',
    },

    // Image-related
    image: {
      broken: 'Image failed to load',
    },

    // Link-related
    link: {
      edit: 'Edit Link',
      open: 'Open Link',
      placeholder: 'Enter link URL',
      unlink: 'Unlink',
    },
  },
};
```

## API

### EditorProvider

| Property | Description                 | Type                   | Default |
| -------- | --------------------------- | ---------------------- | ------- |
| children | Child components            | `ReactNode`            | -       |
| config   | Global configuration object | `EditorProviderConfig` | `{}`    |

## Related Components

- [Editor](/react/editor) - Main editor component
- [ChatInput](/react/chat-input) - Chat input component
- [useTranslation](/editor-kernel/react/use-translation) - Internationalization Hook
