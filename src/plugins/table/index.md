---
nav: Plugins
group: Plugins
title: Table
description: Table plugin provides comprehensive table editing capabilities with internationalization support. It includes table creation, manipulation commands, custom node patching, utility functions, and React components for building rich table editing experiences.
atomId: ReactTablePlugin
---

## Introduction

Table plugin enables full-featured table editing in the editor. Built on Lexical's table functionality, it provides enhanced table operations, internationalization support, custom styling, and specialized commands for table creation and manipulation. The plugin includes utilities for table management and React components for seamless table integration.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Core Architecture

### Table Node System

The plugin extends Lexical's table functionality:

- **TableNode**: Enhanced table node with custom DOM creation
- **Node Patching**: Custom table node modifications for improved functionality
- **Cell Management**: Advanced cell manipulation and navigation
- **Table Structure**: Support for complex table layouts and styling

### Command System

- **INSERT_TABLE_COMMAND**: Create new tables with specified dimensions
- **SELECT_TABLE_COMMAND**: Select entire tables or specific regions
- **Table Utilities**: Helper functions for table operations and validation

### Internationalization

- **i18n Support**: Built-in internationalization for table-related text
- **Localized Labels**: Translatable table commands and interface elements
- **Multiple Languages**: Support for various locales and languages

### Utility Functions

- **Table Operations**: Helper functions for table manipulation
- **Validation**: Table structure validation and error handling
- **Navigation**: Advanced table navigation and selection utilities

## Components

### ReactTablePlugin

React component wrapper for table functionality.

| Property       | Description               | Type                         | Default |
| -------------- | ------------------------- | ---------------------------- | ------- |
| rows           | Initial number of rows    | `number`                     | `3`     |
| columns        | Initial number of columns | `number`                     | `3`     |
| includeHeaders | Include header row        | `boolean`                    | `true`  |
| onTableCreate  | Table creation handler    | `(table: TableData) => void` | -       |

## Commands

### INSERT_TABLE_COMMAND

Create a new table in the editor:

```typescript
editor.dispatchCommand(INSERT_TABLE_COMMAND, {
  rows: 4,
  columns: 3,
  includeHeaders: true,
});
```

**Parameters:**

- `rows`: Number of table rows
- `columns`: Number of table columns
- `includeHeaders`: Whether to include header row

### SELECT_TABLE_COMMAND

Select a table or table region:

```typescript
editor.dispatchCommand(SELECT_TABLE_COMMAND, {
  tableKey: 'table-node-key',
  selection: { startRow: 0, endRow: 2, startCol: 0, endCol: 1 },
});
```

## Plugin Configuration

### TablePluginOptions

| Property       | Description                   | Type             | Default |
| -------------- | ----------------------------- | ---------------- | ------- |
| theme          | Table CSS theme configuration | `TableTheme`     | -       |
| includeHeaders | Default header inclusion      | `boolean`        | `true`  |
| allowResize    | Enable column/row resizing    | `boolean`        | `true`  |
| cellEditor     | Custom cell editor component  | `ReactComponent` | -       |

### TableTheme

CSS theme configuration for table styling:

```typescript
interface TableTheme {
  table?: string;
  tableRow?: string;
  tableCell?: string;
  tableCellHeader?: string;
  tableSelection?: string;
}
```

## Utility Functions

### Table Operations

```typescript
// Check if node is a table
isTableNode(node: LexicalNode): boolean

// Get table dimensions
getTableDimensions(tableNode: TableNode): { rows: number, cols: number }

// Insert row/column
insertTableRow(tableNode: TableNode, index: number): void
insertTableColumn(tableNode: TableNode, index: number): void

// Delete row/column
deleteTableRow(tableNode: TableNode, index: number): void
deleteTableColumn(tableNode: TableNode, index: number): void
```

### Table Navigation

```typescript
// Navigate to cell
navigateToTableCell(
  tableNode: TableNode,
  rowIndex: number,
  colIndex: number
): void

// Get current cell position
getCurrentTableCell(): { row: number, col: number } | null

// Select table range
selectTableRange(
  tableNode: TableNode,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): void
```

## Internationalization

The plugin includes i18n support for table-related text:

```typescript
// Example translations
{
  "table.insert": "Insert Table",
  "table.delete": "Delete Table",
  "table.addRow": "Add Row",
  "table.addColumn": "Add Column",
  "table.deleteRow": "Delete Row",
  "table.deleteColumn": "Delete Column"
}
```

## Usage Examples

### Basic Table Creation

```typescript
const tablePlugin = new TablePlugin(kernel, {
  theme: {
    table: 'custom-table',
    tableCell: 'custom-cell',
    tableCellHeader: 'custom-header',
  },
  includeHeaders: true,
  allowResize: true,
});
```

### Programmatic Table Operations

```typescript
// Create a 3x4 table with headers
editor.dispatchCommand(INSERT_TABLE_COMMAND, {
  rows: 3,
  columns: 4,
  includeHeaders: true,
});

// Add row to existing table
const tableNode = getSelectedTableNode();
if (tableNode) {
  insertTableRow(tableNode, 1);
}
```

### Custom Cell Editor

```typescript
const CustomCellEditor = ({ value, onChange, onSave }) => (
  <input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onBlur={onSave}
    onKeyDown={(e) => e.key === 'Enter' && onSave()}
  />
);

const tablePlugin = new TablePlugin(kernel, {
  cellEditor: CustomCellEditor
});
```
