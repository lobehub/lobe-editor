---
nav: Components
group:
  title: Playground
  order: -1
title: Editor
description: Editor is a comprehensive rich text editor component built on a powerful editor kernel. It supports plugins, mentions, slash commands, various content formats, and comprehensive event handling including keyboard, focus, composition, and context menu events with extensive customization options for modern editing experiences.
apiHeader:
  pkg: '@lobehub/editor/react'
  docUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/react/Editor/index.md'
  sourceUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/react/Editor/index.ts'
---

## Introduction

Editor is a powerful and extensible rich text editor component designed for modern applications. Built on a robust editor kernel, it supports a wide range of features including plugin architecture, mention functionality, slash commands, and multiple content formats. The editor provides both plain text and rich text editing capabilities with comprehensive event handling system and extensive customization options.

### Key Features

- **Plugin Architecture**: Extensible plugin system for custom functionality
- **Event Handling**: Comprehensive event system supporting keyboard, focus, composition, and context menu events
- **Internationalization**: Full support for IME and multi-language input
- **Accessibility**: Built with accessibility in mind
- **Customization**: Extensive theming and styling options
- **Performance**: Optimized for large documents and real-time collaboration

## Basic Usage

<code src="./demos/index.tsx" nopadding iframe></code>

## APIs

### Editor

| Property            | Description                                                              | Type                                                                                    | Default  |
| ------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | -------- |
| autoFocus           | Auto focus on component mount                                            | `boolean`                                                                               | -        |
| children            | Additional content or components                                         | `ReactNode`                                                                             | -        |
| className           | Custom CSS class                                                         | `string`                                                                                | -        |
| content             | Initial editor content                                                   | `ReactEditorContentProps['content']`                                                    | -        |
| editor              | Editor instance to use                                                   | `IEditor`                                                                               | -        |
| enablePasteMarkdown | Enable automatic markdown formatting for pasted content                  | `boolean`                                                                               | `true`   |
| markdownOption      | Enable/disable markdown shortcuts granularly                             | `boolean \| MarkdownFormatOptions`                                                      | `true`   |
| onInit              | Callback called when editor is initialized                               | `(editor: IEditor) => void`                                                             | -        |
| mentionOption       | Configuration for mention functionality                                  | `MentionOption`                                                                         | `{}`     |
| onBlur              | Blur event handler                                                       | `FocusEventHandler<HTMLDivElement>`                                                     | -        |
| onChange            | Content change event handler                                             | `(editor: IEditor) => void`                                                             | -        |
| onCompositionEnd    | IME composition end event handler                                        | `CompositionEventHandler<HTMLDivElement>`                                               | -        |
| onCompositionStart  | IME composition start event handler                                      | `CompositionEventHandler<HTMLDivElement>`                                               | -        |
| onContextMenu       | Context menu event handler                                               | `MouseEventHandler<HTMLDivElement>`                                                     | -        |
| onFocus             | Focus event handler                                                      | `FocusEventHandler<HTMLDivElement>`                                                     | -        |
| onKeyDown           | Key down event handler                                                   | `KeyboardEventHandler<HTMLDivElement>`                                                  | -        |
| onPressEnter        | Enter key press event handler. Return `true` to prevent default behavior | `(props: { editor: IEditor; event: KeyboardEvent<HTMLDivElement> }) => void \| boolean` | -        |
| placeholder         | Placeholder content                                                      | `ReactNode`                                                                             | -        |
| plugins             | Array of editor plugins                                                  | `EditorPlugin[]`                                                                        | `[]`     |
| slashOption         | Configuration for slash commands                                         | `Partial<ReactSlashOptionProps>`                                                        | `{}`     |
| style               | Custom inline styles                                                     | `CSSProperties`                                                                         | -        |
| theme               | Editor theme                                                             | `ReactPlainTextProps['theme']`                                                          | -        |
| type                | Content format type                                                      | `string`                                                                                | `'json'` |
| variant             | Editor variant style                                                     | `ReactPlainTextProps['variant']`                                                        | -        |

### EditorPlugin

Editor plugins can be defined in two formats:

```typescript
type EditorPlugin = FC<any> | [FC<any>, Record<string, any>];
```

### MarkdownFormatOptions

Configuration for fine-grained control of markdown shortcuts:

| Property               | Description                          | Type      | Default |
| ---------------------- | ------------------------------------ | --------- | ------- |
| bold                   | Enable bold formatting (`**text**`)  | `boolean` | `true`  |
| header                 | Enable header shortcuts (`# Header`) | `boolean` | `true`  |
| italic                 | Enable italic formatting (`*text*`)  | `boolean` | `true`  |
| quote                  | Enable blockquote (`> quote`)        | `boolean` | `true`  |
| strikethrough          | Enable strikethrough (`~~text~~`)    | `boolean` | `true`  |
| code                   | Reserved for code formatting         | `boolean` | `true`  |
| underline              | Reserved for underline formatting    | `boolean` | `true`  |
| underlineStrikethrough | Reserved for combined formatting     | `boolean` | `true`  |

**Usage:**

```typescript
// Disable all markdown shortcuts
<Editor markdownOption={false} />

// Enable only specific formats
<Editor
  markdownOption={{
    bold: true,
    italic: true,
    header: false,
    quote: false,
    strikethrough: false,
  }}
/>

// Enable all formats (default)
<Editor markdownOption={true} />
```

### MentionOption

| Property       | Description                     | Type                                        | Default |
| -------------- | ------------------------------- | ------------------------------------------- | ------- |
| items          | Available mention items         | `ReactSlashOptionProps['items']`            | -       |
| markdownWriter | Custom markdown writer function | `ReactMentionPluginProps['markdownWriter']` | -       |

## Markdown Configuration

The Editor provides two complementary configurations for controlling markdown behavior:

### Paste Markdown Formatting (`enablePasteMarkdown`)

Controls whether pasted plain text content is automatically converted to markdown-formatted nodes.

**When enabled (default):**

- Detects markdown patterns in pasted plain text (headers, bold, italic, code blocks, links, etc.)
- Automatically converts to structured editor nodes
- HTML content bypasses this and uses Lexical's rich text handler

**When disabled:**

- All pasted content uses Lexical's default paste handlers
- No automatic markdown detection or conversion

```typescript
// Disable automatic markdown paste formatting
<Editor enablePasteMarkdown={false} />
```

### Markdown Shortcuts (`markdownOption`)

Controls which markdown shortcuts are active while typing (e.g., `**bold**`, `# header`, `> quote`).

**Granular control:**

```typescript
// Disable all markdown shortcuts
<Editor markdownOption={false} />

// Enable only specific formats
<Editor
  markdownOption={{
    bold: true,      // Allow **text** or __text__
    italic: true,    // Allow *text* or _text_
    header: true,    // Allow # Header
    quote: true,     // Allow > quote
    strikethrough: false, // Disable ~~text~~
  }}
/>
```

**Use cases:**

- **Content creation apps**: Enable all shortcuts for power users
- **Strict formatting environments**: Disable shortcuts to prevent unwanted formatting
- **Simplified editors**: Enable only basic formats (bold, italic) for beginners

## Event Handling

The Editor component provides comprehensive event handling capabilities for various user interactions:

### Keyboard Events

- **onKeyDown**: Handles all keyboard input events
- **onPressEnter**: Specific handler for Enter key presses with support for modifier keys (Ctrl/Cmd + Enter). Return `true` to prevent default behavior.

```typescript
const handleKeyDown = ({ editor, event }: { editor: IEditor; event: KeyboardEvent<HTMLDivElement> }) => {
  console.log('Key pressed:', event.key);
};

const handleEnterPress = ({ editor, event }: { editor: IEditor; event: KeyboardEvent<HTMLDivElement> }) => {
  console.log('Enter pressed');

  // Check if it's Ctrl/Cmd + Enter for submission
  if (event.metaKey || event.ctrlKey) {
    // Handle form submission
    const content = editor.getDocument('markdown');
    submitMessage(content);
    return true; // Prevent default behavior
  }

  // For regular Enter, allow default behavior (new line)
  return false;
};

<Editor
  onKeyDown={handleKeyDown}
  onPressEnter={handleEnterPress}
/>
```

### Focus Events

- **onFocus**: Triggered when the editor gains focus
- **onBlur**: Triggered when the editor loses focus
- **autoFocus**: Automatically focus the editor on mount

```typescript
const handleFocus = (e: FocusEvent<HTMLDivElement>) => {
  console.log('Editor focused');
};

const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
  console.log('Editor blurred');
};

<Editor
  autoFocus={true}
  onFocus={handleFocus}
  onBlur={handleBlur}
/>
```

### Composition Events

Essential for handling Input Method Editor (IME) input for languages like Chinese, Japanese, and Korean:

- **onCompositionStart**: Triggered when IME composition begins
- **onCompositionEnd**: Triggered when IME composition ends

```typescript
const [isComposing, setIsComposing] = useState(false);

const handleCompositionStart = (e: CompositionEvent<HTMLDivElement>) => {
  setIsComposing(true);
  console.log('Composition started');
};

const handleCompositionEnd = (e: CompositionEvent<HTMLDivElement>) => {
  setIsComposing(false);
  console.log('Composition ended:', e.data);
};

<Editor
  onCompositionStart={handleCompositionStart}
  onCompositionEnd={handleCompositionEnd}
/>
```

### Context Menu Events

- **onContextMenu**: Handles right-click context menu events

```typescript
const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
  e.preventDefault(); // Prevent default browser context menu

  // Show custom context menu
  showCustomMenu({
    x: e.clientX,
    y: e.clientY,
    items: [
      { label: 'Copy', action: () => document.execCommand('copy') },
      { label: 'Paste', action: () => document.execCommand('paste') },
      { label: 'Cut', action: () => document.execCommand('cut') },
    ]
  });
};

<Editor onContextMenu={handleContextMenu} />
```

## Advanced Usage

### Complete Event Handling Example

```typescript
import { Editor } from '@lobehub/editor/react';
import { useState } from 'react';

function MyEditor() {
  const [isComposing, setIsComposing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Editor
      autoFocus={true}
      placeholder="Start typing..."
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onCompositionStart={() => setIsComposing(true)}
      onCompositionEnd={() => setIsComposing(false)}
      onKeyDown={(e) => {
        // Handle special key combinations
        if (e.ctrlKey && e.key === 's') {
          e.preventDefault();
          // Save content
        }
      }}
      onPressEnter={(e) => {
        if (e.ctrlKey) {
          // Submit on Ctrl+Enter
          handleSubmit();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        // Show custom context menu
      }}
      onChange={(editor) => {
        // Handle content changes
        console.log('Content changed');
      }}
    />
  );
}
```

### Static Methods

The Editor component also provides static methods:

- `Editor.useEditor`: **@deprecated** Hook for accessing editor reference
- `Editor.withProps`: Higher-order component for prop injection

### Hooks

- `useEditor()`: Hook for creating editor instance
- `useEditorState(editor)`: Hook for accessing editor state and toolbar methods

### Modern Usage Example

```typescript
import { Editor, useEditor } from '@lobehub/editor/react';
import { ReactCodeblockPlugin } from '@lobehub/editor';

function MyEditor() {
  const editor = useEditor(); // Get editor instance directly

  const handleInit = (editor: IEditor) => {
    console.log('Editor initialized:', editor);
  };

  return (
    <Editor
      editor={editor}
      onInit={handleInit}
      placeholder="Start typing..."
      plugins={[ReactCodeblockPlugin]}
      onChange={(editor) => {
        console.log('Content changed:', editor.getDocument('markdown'));
      }}
    />
  );
}
```
