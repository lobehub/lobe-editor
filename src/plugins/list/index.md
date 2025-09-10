---
nav: Plugins
group: Plugins
title: List
description: List plugin provides comprehensive list functionality for ordered and unordered lists. It includes list creation, nesting, conversion commands, utility functions, and React components for building rich list editing experiences with markdown shortcuts and keyboard navigation.
atomId: ReactListPlugin
---

## Introduction

List plugin enables advanced list functionality in the editor. It supports both ordered and unordered lists with multi-level nesting, list item manipulation, and provides comprehensive list management commands. The plugin includes markdown shortcuts for quick list creation, keyboard navigation, and React components for seamless list integration.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Core Architecture

### List Node System

The plugin leverages Lexical's list functionality:

- **ListNode**: Container for list items with type support (ordered/unordered)
- **ListItemNode**: Individual list items with nesting capabilities
- **Multi-level Nesting**: Support for deeply nested list structures
- **Type Conversion**: Convert between ordered and unordered lists

### Command System

- **List Creation**: Commands for creating new lists
- **List Conversion**: Convert between ordered and unordered lists
- **Indentation**: Increase/decrease list item nesting
- **Item Management**: Add, remove, and manipulate list items

### Markdown Integration

- **Shortcuts**: Markdown shortcuts for list creation (-, \*, +, 1.)
- **Export/Import**: Markdown serialization with proper list formatting
- **Auto-detection**: Automatic list creation from markdown patterns

### Navigation & Interaction

- **Keyboard Navigation**: Arrow keys, Tab/Shift+Tab for indentation
- **List Behaviors**: Enter for new items, Backspace for de-nesting
- **Selection Handling**: Multi-item selection and operations

## Components

### ReactListPlugin

React component wrapper for list functionality.

| Property       | Description                | Type                       | Default    |
| -------------- | -------------------------- | -------------------------- | ---------- |
| type           | List type                  | `'bullet' \| 'number'`     | `'bullet'` |
| nested         | Enable nested lists        | `boolean`                  | `true`     |
| markdown       | Enable markdown shortcuts  | `boolean`                  | `true`     |
| onListCreate   | List creation handler      | `(type: ListType) => void` | -          |
| onItemAdd      | List item addition handler | `(item: ListItem) => void` | -          |
| onIndentChange | Indentation change handler | `(level: number) => void`  | -          |

## Commands

### List Commands

```typescript
// Create unordered list
editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND);

// Create ordered list
editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND);

// Remove list formatting
editor.dispatchCommand(REMOVE_LIST_COMMAND);

// Indent list item
editor.dispatchCommand(INDENT_LIST_COMMAND);

// Outdent list item
editor.dispatchCommand(OUTDENT_LIST_COMMAND);
```

## Plugin Configuration

### ListPluginOptions

| Property        | Description                   | Type        | Default |
| --------------- | ----------------------------- | ----------- | ------- |
| theme           | List CSS theme configuration  | `ListTheme` | -       |
| maxNestingLevel | Maximum nesting depth         | `number`    | `7`     |
| enableMarkdown  | Enable markdown shortcuts     | `boolean`   | `true`  |
| autoIndent      | Auto-indent on new list items | `boolean`   | `true`  |

### ListTheme

CSS theme configuration for list styling:

```typescript
interface ListTheme {
  list?: string;
  listItem?: string;
  listItemChecked?: string;
  listItemUnchecked?: string;
  nestedListItem?: string;
  olDepth?: string[];
  ulDepth?: string[];
}
```

## Utility Functions

### List Operations

```typescript
// List type checking
isListNode(node: LexicalNode): boolean
isListItemNode(node: LexicalNode): boolean

// List manipulation
createList(type: 'bullet' | 'number'): ListNode
addListItem(list: ListNode, text: string): ListItemNode

// Nesting operations
indentListItem(item: ListItemNode): void
outdentListItem(item: ListItemNode): void
getListItemDepth(item: ListItemNode): number

// List conversion
convertToNumberList(list: ListNode): void
convertToBulletList(list: ListNode): void

// List traversal
getListItems(list: ListNode): ListItemNode[]
getParentList(item: ListItemNode): ListNode | null
```

### Markdown Shortcuts

```typescript
// Supported markdown patterns
const LIST_PATTERNS = {
  unordered: /^[-*+]\s/,
  ordered: /^\d+\.\s/,
  nested: /^(\s+)[-*+]\s/,
  nestedOrdered: /^(\s+)\d+\.\s/,
};

// Auto-convert markdown to lists
const MARKDOWN_TRANSFORMERS = [
  {
    dependencies: [ListNode, ListItemNode],
    export: (node: ListNode) => {
      const type = node.getListType();
      const items = getListItems(node);
      return items
        .map((item, index) => {
          const prefix = type === 'number' ? `${index + 1}. ` : '- ';
          return prefix + item.getTextContent();
        })
        .join('\n');
    },
    regExp: /^[-*+]\s/,
    replace: (textNode, match) => {
      const list = createList('bullet');
      const item = addListItem(list, '');
      return list;
    },
    trigger: ' ',
    type: 'element',
  },
];
```

## Usage Examples

### Basic List Setup

```typescript
const listPlugin = new ListPlugin(kernel, {
  theme: {
    list: 'custom-list',
    listItem: 'custom-list-item',
    nestedListItem: 'custom-nested-item',
  },
  maxNestingLevel: 5,
  enableMarkdown: true,
  autoIndent: true,
});
```

### Programmatic List Creation

```typescript
// Create bullet list
editor.update(() => {
  const list = createList('bullet');
  addListItem(list, 'First item');
  addListItem(list, 'Second item');
  $insertNodes([list]);
});

// Create numbered list
editor.update(() => {
  const list = createList('number');
  addListItem(list, 'Step 1');
  addListItem(list, 'Step 2');
  $insertNodes([list]);
});
```

### Custom List Behaviors

```typescript
// Custom indentation handler
const handleTabKey = (event: KeyboardEvent) => {
  if (event.key === 'Tab') {
    event.preventDefault();
    if (event.shiftKey) {
      editor.dispatchCommand(OUTDENT_LIST_COMMAND);
    } else {
      editor.dispatchCommand(INDENT_LIST_COMMAND);
    }
  }
};

// Custom Enter key behavior
const handleEnterKey = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const node = getSelectedNode(selection);
      if (isListItemNode(node) && node.getTextContent() === '') {
        // Empty list item - outdent or exit list
        event.preventDefault();
        if (getListItemDepth(node) > 0) {
          outdentListItem(node);
        } else {
          editor.dispatchCommand(REMOVE_LIST_COMMAND);
        }
      }
    }
  }
};
```

### Nested List Example

```typescript
// Create nested list structure
editor.update(() => {
  const list = createList('bullet');

  const item1 = addListItem(list, 'Main item 1');
  const nestedList1 = createList('bullet');
  addListItem(nestedList1, 'Sub item 1.1');
  addListItem(nestedList1, 'Sub item 1.2');
  item1.append(nestedList1);

  const item2 = addListItem(list, 'Main item 2');

  $insertNodes([list]);
});
```

### Markdown Integration

```typescript
// Enable markdown shortcuts
const markdownShortcuts = [
  '- ',
  '* ',
  '+ ', // Unordered list
  '1. ',
  '2. ', // Ordered list (auto-detects numbering)
];

// Custom markdown transformer
const customListTransformer = {
  dependencies: [ListNode, ListItemNode],
  regExp: /^(\s*)[-*+]\s(.*)$/,
  replace: (textNode, match) => {
    const indent = match[1].length;
    const text = match[2];

    const list = createList('bullet');
    const item = addListItem(list, text);

    // Handle indentation
    if (indent > 0) {
      // Add appropriate nesting
      for (let i = 0; i < Math.floor(indent / 2); i++) {
        indentListItem(item);
      }
    }

    return list;
  },
  trigger: ' ',
  type: 'element',
};
```
