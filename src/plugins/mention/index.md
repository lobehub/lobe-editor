---
nav: Plugins
group: Plugins
title: Mention
description: Mention plugin enables @-style mentions in the editor. It provides a complete mention system with customizable decorators, markdown serialization, command support, and React components for rendering mention items with autocomplete functionality.
atomId: ReactMentionPlugin
---

## Introduction

Mention plugin provides comprehensive @-style mention functionality for the editor. It allows users to mention people, objects, or any custom entities using the @ symbol. The plugin includes a robust architecture with custom node types, command handling, selection observers, and React components for rendering mention UI with autocomplete capabilities.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Core Architecture

### MentionNode

The plugin introduces a custom `MentionNode` that extends Lexical's `DecoratorNode`:

- **Serialization**: Supports JSON serialization/deserialization for persistence
- **DOM Integration**: Handles HTML import/export with span elements
- **Custom Data**: Stores label and additional metadata for each mention

### Plugin System

- **MentionPlugin**: Core plugin class that registers nodes, themes, and decorators
- **Command Handler**: `INSERT_MENTION_COMMAND` for programmatic mention insertion
- **Selection Observer**: Tracks mention node selection for enhanced UX

### Markdown Support

- **Writer Integration**: Converts mentions to markdown format during export
- **Custom Writers**: Supports custom markdown serialization functions

## Components

### ReactMentionPlugin

React component wrapper for the mention plugin functionality.

| Property  | Description               | Type                               | Default |
| --------- | ------------------------- | ---------------------------------- | ------- |
| items     | Available mention items   | `MentionItem[]`                    | `[]`    |
| onSelect  | Mention selection handler | `(item: MentionItem) => void`      | -       |
| decorator | Custom mention renderer   | `(node: MentionNode) => ReactNode` | -       |

## Commands

### INSERT_MENTION_COMMAND

Programmatically insert mentions into the editor:

```typescript
editor.dispatchCommand(INSERT_MENTION_COMMAND, {
  label: '@username',
  metadata: { id: 'user123', avatar: '...' },
});
```

**Parameters:**

- `label`: Display text for the mention
- `metadata`: Additional metadata object

## Plugin Configuration

### MentionPluginOptions

| Property       | Description                      | Type                                 | Default |
| -------------- | -------------------------------- | ------------------------------------ | ------- |
| decorator      | Custom mention renderer function | `(node: MentionNode, editor) => any` | -       |
| markdownWriter | Custom markdown serialization    | `(node: MentionNode) => string`      | -       |
| theme          | CSS theme configuration          | `{ mention?: string }`               | -       |

## Usage Examples

### Basic Mention Setup

```typescript
// Register the mention plugin
const mentionPlugin = new MentionPlugin(kernel, {
  decorator: (node, editor) => <MentionRenderer node={node} />,
  markdownWriter: (node) => `[@${node.label}](${node.getId()})`,
  theme: { mention: 'custom-mention-class' }
});
```

### Custom Mention Component

```typescript
const MentionRenderer = ({ node }) => (
  <span className="mention-item">
    <Avatar src={node.metadata?.avatar} />
    {node.getLabel()}
  </span>
);
```
