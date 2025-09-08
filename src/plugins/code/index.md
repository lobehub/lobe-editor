---
nav: Plugins
group: Plugins
title: Code
description: Code plugin enables inline code formatting in the editor. It provides a custom CodeNode for representing inline code snippets with keyboard shortcuts, markdown serialization, and React components for seamless code highlighting integration.
atomId: ReactCodePlugin
---

## Introduction

Code plugin provides comprehensive inline code functionality for the editor. It allows users to format text as inline code using keyboard shortcuts or commands. The plugin features a custom node implementation with card-like behavior, markdown serialization support, and integration with the editor's theming system for consistent styling across different use cases.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Core Architecture

### CodeNode

The plugin introduces a custom `CodeNode` that extends `CardLikeElementNode`:

- **Inline Behavior**: Renders as an inline element within text flow
- **Card-like Properties**: Provides structured editing experience with cursor navigation
- **DOM Structure**: Uses custom `ne-content` container for content management
- **Serialization**: Supports JSON serialization/deserialization for persistence

### Plugin System

- **CodePlugin**: Core plugin class that registers nodes, themes, and commands
- **Command Integration**: `INSERT_CODEINLINE_COMMAND` for programmatic code insertion
- **Markdown Support**: Automatic markdown writer registration for code serialization
- **Selection Handling**: Smart selection detection within code blocks

### Theme Integration

- **CSS Classes**: Configurable theme support with `codeInline` class
- **Custom Styling**: Allows custom CSS class injection for appearance customization

## Components

### ReactCodePlugin

React component wrapper for the code plugin functionality.

| Property  | Description           | Type     | Default |
| --------- | --------------------- | -------- | ------- |
| className | Custom CSS class name | `string` | -       |

## Commands

### INSERT_CODEINLINE_COMMAND

Programmatically insert or toggle inline code formatting:

```typescript
import { INSERT_CODEINLINE_COMMAND } from '@lobehub/editor';

// Toggle inline code formatting for current selection
editor.dispatchCommand(INSERT_CODEINLINE_COMMAND, undefined);
```

**Behavior:**

- Creates new code node from current selection if not in code
- Removes code formatting if already inside a code node
- Handles proper cursor positioning and text content preservation

## Plugin Configuration

### CodePluginOptions

| Property | Description                 | Type     | Default         |
| -------- | --------------------------- | -------- | --------------- |
| theme    | CSS class for code elements | `string` | `'editor-code'` |

## Node API

### CodeNode Methods

The `CodeNode` provides several utility methods:

```typescript
// Create a new code node
const codeNode = $createCodeNode('console.log("Hello")');

// Check if a node is a code node
if ($isCodeInlineNode(node)) {
  // Handle code node logic
}

// Check if current selection is in code
if ($isSelectionInCodeInline(editor)) {
  // Selection is within inline code
}
```

### Node Properties

- **isInline()**: Returns `true` - renders inline with text
- **isCardLike()**: Returns `true` - provides card-like editing behavior
- **canBeEmpty()**: Returns `false` - prevents empty code nodes
- **canInsertTextBefore/After()**: Returns `true` - allows text insertion around code

## Markdown Integration

The plugin automatically registers markdown serialization:

```typescript
// Inline code is serialized as:
`code content`; // Backtick-wrapped text
```

The markdown writer converts `CodeNode` content to standard markdown inline code format with proper escaping.

## Usage Examples

### Basic Setup

```typescript
import { CodePlugin, ReactCodePlugin } from '@lobehub/editor';

// Register the plugin
const codePlugin = new CodePlugin(kernel, {
  theme: 'custom-code-class'
});

// Use in React
<Editor
  plugins={[ReactCodePlugin]}
/>
```

### Custom Styling

```typescript
// With custom CSS class
<ReactCodePlugin className="my-custom-code-style" />
```

```css
.my-custom-code-style {
  background: #f5f5f5;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Monaco', 'Consolas', monospace;
}
```

### Programmatic Usage

```typescript
import { $createCodeNode, INSERT_CODEINLINE_COMMAND } from '@lobehub/editor';

// Insert code via command
const insertInlineCode = () => {
  editor.dispatchCommand(INSERT_CODEINLINE_COMMAND, undefined);
};

// Create code node directly
editor.update(() => {
  const codeNode = $createCodeNode('const x = 42;');
  $insertNodes([codeNode]);
});
```

### Keyboard Shortcuts

The plugin integrates with the markdown shortcut system for quick code formatting:

```typescript
// Users can type backticks to create inline code
`text`; // Converts to inline code automatically
```

## Selection Utilities

```typescript
import { $isSelectionInCodeInline } from '@lobehub/editor';

// Check if current selection is in inline code
const isInCode = $isSelectionInCodeInline(editor);

if (isInCode) {
  // Disable certain formatting options
  // Show code-specific toolbar
}
```
