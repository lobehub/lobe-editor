---
nav: Plugins
group: Plugins
title: Slash
description: Slash plugin enables powerful slash commands (/command) in the editor. It provides intelligent command detection, fuzzy search, customizable triggers, and React components for building interactive command menus with autocomplete functionality.
atomId: ReactSlashPlugin, ReactSlashOption
---

## Introduction

Slash plugin provides a sophisticated slash command system that allows users to quickly insert content and trigger actions using "/" commands. The plugin features intelligent text parsing, fuzzy search capabilities, multiple trigger support, and a service-oriented architecture that enables extensible command registration and management.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Core Architecture

### SlashService

The plugin implements `ISlashService` for managing slash options:

- **Command Registration**: Register custom slash commands with triggers
- **Fuzzy Search**: Built-in Fuse.js integration for intelligent command matching
- **Multiple Triggers**: Support for various trigger characters (/, #, etc.)
- **Dynamic Options**: Async command loading and contextual options

### Plugin System

- **SlashPlugin**: Core plugin that handles text monitoring and command detection
- **Real-time Detection**: Monitors editor input for trigger patterns
- **Position Tracking**: Accurate cursor positioning for command UI
- **Context Management**: Maintains command state and context information

### Service Integration

- **ISlashService**: Service interface for command management
- **Trigger Functions**: Customizable pattern matching for command detection
- **Option Filtering**: Dynamic option filtering based on input context

## Components

### ReactSlashPlugin

React component wrapper for slash functionality.

| Property  | Description              | Type                                | Default |
| --------- | ------------------------ | ----------------------------------- | ------- |
| options   | Available slash options  | `SlashOption[]`                     | `[]`    |
| onSelect  | Option selection handler | `(option: SlashOption) => void`     | -       |
| onTrigger | Command trigger handler  | `(context: TriggerContext) => void` | -       |

### ReactSlashOption

Individual slash command option component.

| Property | Description        | Type         | Default |
| -------- | ------------------ | ------------ | ------- |
| icon     | Option icon        | `ReactNode`  | -       |
| title    | Option title       | `string`     | -       |
| subtitle | Option description | `string`     | -       |
| onSelect | Selection callback | `() => void` | -       |

## Service API

### ISlashService

Core service interface for managing slash commands:

```typescript
interface ISlashService {
  registerSlash(options: SlashOptions): void;
  getSlashOptions(trigger: string): SlashOptions | undefined;
  getSlashTriggerFn(trigger: string): TriggerFunction | undefined;
  getSlashFuse(trigger: string): Fuse<ISlashOption> | undefined;
}
```

### SlashOptions Configuration

| Property         | Description                       | Type                           | Default        |
| ---------------- | --------------------------------- | ------------------------------ | -------------- |
| trigger          | Trigger character                 | `string`                       | `'/'`          |
| items            | Available command items           | `ISlashOption[]` or `Function` | `[]`           |
| maxLength        | Maximum input length              | `number`                       | `75`           |
| matchingFields   | Custom matching fields for search | `string[]`                     | `['key']`      |
| matchingStrategy | Matching strategy for search      | `'startsWith'` \| `'fuzzy'`    | `'startsWith'` |
| triggerFn        | Custom trigger function           | `(text: string) => Match`      | -              |

### ISlashOption

| Property | Description       | Type         | Default |
| -------- | ----------------- | ------------ | ------- |
| key      | Unique identifier | `string`     | -       |
| title    | Display title     | `string`     | -       |
| subtitle | Description text  | `string`     | -       |
| icon     | Option icon       | `ReactNode`  | -       |
| onSelect | Selection handler | `() => void` | -       |

## Plugin Configuration

### SlashPluginOptions

| Property     | Description                   | Type                             | Default |
| ------------ | ----------------------------- | -------------------------------- | ------- |
| slashOptions | Array of slash configurations | `SlashOptions[]`                 | `[]`    |
| triggerOpen  | Menu open callback            | `(ctx: ITriggerContext) => void` | -       |
| triggerClose | Menu close callback           | `() => void`                     | -       |

## Usage Examples

### Basic Slash Setup

```typescript
const slashPlugin = new SlashPlugin(kernel, {
  slashOptions: [{
    trigger: '/',
    items: [
      { key: 'heading', title: 'Heading', icon: <HeadingIcon /> },
      { key: 'list', title: 'List', icon: <ListIcon /> }
    ]
  }],
  triggerOpen: (context) => showSlashMenu(context),
  triggerClose: () => hideSlashMenu()
});
```

### Dynamic Command Loading

```typescript
const dynamicSlashOptions = {
  trigger: '#',
  matchingStrategy: 'startsWith', // Search will be applied after async loading
  matchingFields: ['key', 'title'], // Fields to search on
  items: async (search) => {
    // Load all commands first
    const commands = await fetchCommands();
    return commands.map((cmd) => ({
      key: cmd.id,
      title: cmd.name,
      description: cmd.description,
      onSelect: () => executeCommand(cmd),
    }));
    // Search filtering will be automatically applied after loading
    // based on search.matchingString using the configured strategy
  },
};
```

### Custom Matching Configuration

```typescript
// Use startsWith matching with key field (default behavior)
const startsWithMatching = {
  trigger: '/',
  matchingStrategy: 'startsWith', // Default strategy
  matchingFields: ['key'], // Default field
  items: [
    { key: 'heading1', title: 'Heading 1' },
    { key: 'heading2', title: 'Heading 2' },
    { key: 'list', title: 'List' },
  ],
};
// Typing 'h' will match 'heading1' and 'heading2'

// Use custom fields for matching
const customFieldMatching = {
  trigger: '@',
  matchingStrategy: 'startsWith',
  matchingFields: ['title', 'description'], // Match by title and description
  items: [
    { key: 'user1', title: 'John Doe', description: 'Developer' },
    { key: 'user2', title: 'Jane Smith', description: 'Designer' },
  ],
};
// Typing 'john' or 'dev' will match the first item

// Use fuzzy matching for more flexible search
const fuzzyMatching = {
  trigger: '#',
  matchingStrategy: 'fuzzy',
  matchingFields: ['key', 'title'],
  items: [
    { key: 'react-component', title: 'React Component' },
    { key: 'vue-template', title: 'Vue Template' },
  ],
};
// Typing 'comp' will match 'react-component' even with characters in between
```

### Custom Trigger Function

```typescript
const customTrigger = (text: string) => {
  const match = text.match(/\/(\w*)$/);
  return match
    ? {
        leadOffset: match.index,
        matchingString: match[1],
        replaceableString: match[0],
      }
    : null;
};
```
