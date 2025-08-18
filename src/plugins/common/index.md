---
nav: Plugins
group:
  title: Core
  order: -1
title: Common
description: Common plugin provides the foundational editor components and utilities. It includes the core ReactEditor, ReactEditorContent, and ReactPlainText components, along with essential editor services, node types, and data source management for building rich text editing experiences.
atomId: ReactEditor, ReactEditorContent, ReactPlainText
---

## Introduction

Common plugin serves as the foundation of the editor system, providing essential components and utilities that other plugins depend on. It includes the core React components for rendering editor content, managing plain text input, and handling fundamental editor operations. This plugin also provides data source management, utility functions, and base node types that are used throughout the editor ecosystem.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Components

### ReactEditor

The core editor wrapper component that provides the editing environment.

### ReactEditorContent

Component for rendering rich text editor content with full formatting support.

### ReactPlainText

Simplified component for plain text editing without rich formatting.

## Core Architecture

### Plugin System

- **Plugin Interface**: Standardized plugin architecture for extending editor functionality
- **Service Registration**: Centralized service container for plugin communication
- **Command System**: Event-driven command pattern for editor operations

### Data Sources

- **Content Management**: Unified content storage and retrieval
- **State Synchronization**: Real-time state management across components
- **Serialization**: Content serialization for persistence and transport

### Node System

- **Base Nodes**: Fundamental node types (text, paragraph, etc.)
- **Custom Nodes**: Framework for creating specialized content types
- **Node Transformations**: Utilities for node manipulation and conversion

### Utilities

- **Editor Helpers**: Common editor operation utilities
- **DOM Management**: Cross-browser DOM manipulation helpers
- **Event Handling**: Standardized event processing and delegation

## APIs

### ReactEditor

| Property  | Description          | Type            | Default |
| --------- | -------------------- | --------------- | ------- |
| children  | Editor content       | `ReactNode`     | -       |
| className | Custom CSS class     | `string`        | -       |
| style     | Custom inline styles | `CSSProperties` | -       |

### ReactEditorContent

| Property | Description            | Type                 | Default |
| -------- | ---------------------- | -------------------- | ------- |
| content  | Editor content data    | `EditorContentProps` | -       |
| onChange | Content change handler | `(content) => void`  | -       |

### ReactPlainText

| Property | Description     | Type                      | Default |
| -------- | --------------- | ------------------------- | ------- |
| theme    | Text theme      | `PlainTextTheme`          | -       |
| variant  | Display variant | `PlainTextVariant`        | -       |
| value    | Text content    | `string`                  | -       |
| onChange | Change handler  | `(value: string) => void` | -       |
