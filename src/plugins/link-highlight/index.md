---
nav: Plugins
group: Plugins
title: LinkHighlight
description: Link Highlight plugin enables inline link highlighting in the editor. It provides a custom LinkHighlightNode for representing links as highlighted inline elements with direct editing, markdown serialization, and seamless integration for displaying clickable links.
atomId: ReactLinkHighlightPlugin
---

## Introduction

Link Highlight plugin provides comprehensive inline link highlighting functionality for the editor. It allows users to format URLs as highlighted inline links using keyboard shortcuts, markdown syntax, or commands. Unlike the standard Link plugin which separates text and URL (`[text](url)`), this plugin treats the entire link as a single highlighted entity that can be edited directly, similar to inline code. The plugin features a custom node implementation with card-like behavior, markdown serialization support (`<link>` format), and integration with the editor's theming system for consistent styling.

## Basic Usage

<code src="./demos/index.tsx"></code>

**Important:** The `ReactLinkHighlightPlugin` must be placed **before** `ReactPlainText` to ensure the plugin is registered before content is loaded. This is because LinkHighlightNode extends `CardLikeElementNode` and needs to be available during JSON deserialization.

## Core Architecture

### LinkHighlightNode

The plugin introduces a custom `LinkHighlightNode` that extends `CardLikeElementNode`:

- **Inline Behavior**: Renders as an inline element within text flow
- **Card-like Properties**: Provides structured editing experience with cursor navigation
- **Direct Editing**: Links can be edited directly without popup dialogs
- **DOM Structure**: Uses custom `ne-content` container for content management
- **Serialization**: Supports JSON serialization/deserialization for persistence
- **URL Access**: Provides `getURL()` method to retrieve the link from text content

### Plugin System

- **LinkHighlightPlugin**: Core plugin class that registers nodes, themes, and commands
- **Command Integration**: `INSERT_LINK_HIGHLIGHT_COMMAND` for programmatic link insertion
- **Markdown Support**: Automatic markdown writer registration for link serialization
- **Selection Handling**: Smart selection detection within link highlight blocks
- **Hotkey Support**: Configurable keyboard shortcuts (Ctrl+K / Cmd+K by default)

### Theme Integration

- **CSS Classes**: Configurable theme support with `linkHighlight` class
- **Custom Styling**: Allows custom CSS class injection for appearance customization
- **Visual Feedback**: Hover states and active styling for better UX

## Components

### ReactLinkHighlightPlugin

React component wrapper for the link highlight plugin functionality.

| Property                 | Description                       | Type      | Default |
| ------------------------ | --------------------------------- | --------- | ------- |
| className                | Custom CSS class name             | `string`  | -       |
| enableHotkey             | Enable keyboard shortcut (Ctrl+K) | `boolean` | `true`  |
| enablePasteAutoHighlight | Auto-highlight when pasting URLs  | `boolean` | `true`  |

## Commands

### INSERT_LINK_HIGHLIGHT_COMMAND

Programmatically insert or toggle inline link highlighting:

```typescript
import { INSERT_LINK_HIGHLIGHT_COMMAND } from '@lobehub/editor';

// Toggle link highlight formatting for current selection
editor.dispatchCommand(INSERT_LINK_HIGHLIGHT_COMMAND, undefined);
```

**Behavior:**

- Creates new link highlight node from current selection if not in a highlighted link
- Removes link highlight formatting if already inside a link highlight node
- Handles proper cursor positioning and text content preservation
- Integrates with hotkey system for keyboard shortcuts

## Plugin Configuration

### LinkHighlightPluginOptions

| Property                 | Description                      | Type      | Default                   |
| ------------------------ | -------------------------------- | --------- | ------------------------- |
| theme                    | CSS class for link elements      | `string`  | `'editor-link-highlight'` |
| enableHotkey             | Enable keyboard shortcut         | `boolean` | `true`                    |
| enablePasteAutoHighlight | Auto-highlight when pasting URLs | `boolean` | `true`                    |
| urlRegex                 | Custom URL validation regex      | `RegExp`  | Built-in URL pattern      |

## Node API

### LinkHighlightNode Methods

The `LinkHighlightNode` provides several utility methods:

```typescript
// Create a new link highlight node
const linkHighlightNode = $createLinkHighlightNode('https://example.com');

// Check if a node is a link highlight node
if ($isLinkHighlightNode(node)) {
  // Handle link highlight node logic
  const url = node.getURL();
}

// Check if current selection is in link highlight
if ($isSelectionInLinkHighlight(editor)) {
  // Selection is within highlighted link
}
```

### Node Properties

- **isInline()**: Returns `true` - renders inline with text
- **isCardLike()**: Returns `true` - provides card-like editing behavior
- **canBeEmpty()**: Returns `false` - prevents empty link highlight nodes
- **canInsertTextBefore/After()**: Returns `true` - allows text insertion around links
- **getURL()**: Returns the URL string from the text content

## Markdown Integration

The plugin automatically registers markdown serialization:

```typescript
// Link highlight is serialized as:
<https://example.com>; // Angle bracket-wrapped URL

// Also works with other URL formats:
<mailto:user@example.com>
<tel:+1234567890>
```

The markdown writer converts `LinkHighlightNode` content to `<url>` format, and the reader converts it back during parsing.

### Markdown Shortcuts

Type the link inside angle brackets and it will automatically convert to a highlighted link:

```markdown
<https://example.com> → Highlighted link
<user@example.com> → Highlighted email link
```

### Pasting Markdown Content

When you paste markdown content containing auto-link syntax, it will be automatically converted to LinkHighlightNode:

```markdown
Check out <https://www.google.com.hk/> for more info.
Visit <mailto:support@example.com> for help.
```

**How it works:**

- Plugin registers a high-priority markdown reader for `link` type nodes
- Detects auto-links where URL and display text are identical
- Converts to `LinkHighlightNode` instead of standard `LinkNode`
- Standard links like `[text](url)` are handled by Link plugin (if registered)

## Usage Examples

### Basic Setup

```typescript
import {
  ReactEditor,
  ReactEditorContent,
  ReactPlainText,
  ReactLinkHighlightPlugin
} from '@lobehub/editor';

export default () => {
  return (
    <ReactEditor>
      {/* Plugin must be placed before ReactPlainText */}
      <ReactLinkHighlightPlugin />
      <ReactPlainText>
        <ReactEditorContent content={content} type="json" />
      </ReactPlainText>
    </ReactEditor>
  );
};
```

### Custom Styling

```typescript
// With custom CSS class
<ReactLinkHighlightPlugin className="my-custom-link-highlight-style" />
```

```css
.my-custom-link-highlight-style {
  color: #0066cc;
  background: rgba(0, 102, 204, 0.1);
  border: 1px solid #0066cc;
  border-radius: 4px;
  padding: 2px 6px;
  font-family: 'Monaco', 'Consolas', monospace;
  text-decoration: none;
  transition: all 0.2s ease;
}

.my-custom-link-highlight-style:hover {
  background: rgba(0, 102, 204, 0.2);
  border-color: #0052a3;
}
```

### Programmatic Usage

```typescript
import { $createLinkHighlightNode, INSERT_LINK_HIGHLIGHT_COMMAND } from '@lobehub/editor';

// Insert link highlight via command
const insertLinkHighlight = () => {
  editor.dispatchCommand(INSERT_LINK_HIGHLIGHT_COMMAND, undefined);
};

// Create link highlight node directly
editor.update(() => {
  const linkHighlightNode = $createLinkHighlightNode('https://example.com');
  $insertNodes([linkHighlightNode]);
});
```

### Keyboard Shortcuts

The plugin integrates with the hotkey system for quick link highlighting:

```typescript
// Users can press Ctrl+K (Cmd+K on Mac) to toggle link highlight
// Or type <url> to create highlighted link automatically
```

### Disabling Hotkeys

```typescript
// Disable keyboard shortcuts if needed
<ReactLinkHighlightPlugin enableHotkey={false} />
```

### Paste Auto-Highlighting

When you paste a URL, it will automatically be converted to a highlighted link:

```typescript
// Default behavior - auto-highlighting enabled
<ReactLinkHighlightPlugin />

// Disable paste auto-highlighting
<ReactLinkHighlightPlugin enablePasteAutoHighlight={false} />
```

**Supported URL formats:**

- HTTP/HTTPS: `https://example.com`
- Mailto: `mailto:user@example.com`
- Tel: `tel:+1234567890`
- WWW: `www.example.com`

When you paste any of these URL formats into the editor, they will automatically be wrapped in a `LinkHighlightNode` with the appropriate styling.

### Click to Open Links

Click on any highlighted link to open it in a new window:

**Click behavior:**

- **Left Click**: Opens link in new window with `noopener,noreferrer` security
- **Ctrl/Cmd + Click**: Browser handles (for alternate behaviors)
- **Shift + Click**: Browser handles (for window/tab preferences)

**URL Formatting:**

- URLs without protocol automatically get `https://`
- `www.example.com` → `https://www.example.com`
- Email addresses → `mailto:user@example.com`
- Phone numbers → `tel:+1234567890`
- Existing protocols (http, https, mailto, tel) are preserved

```typescript
// Click a highlighted link - it opens automatically
// No additional configuration needed
<ReactLinkHighlightPlugin />
```

## Selection Utilities

```typescript
import { $isSelectionInLinkHighlight } from '@lobehub/editor';

// Check if current selection is in link highlight
const isInLinkHighlight = $isSelectionInLinkHighlight(editor);

if (isInLinkHighlight) {
  // Disable certain formatting options
  // Show link-specific toolbar
}
```

## Comparison with Link Plugin

### Standard Link Plugin

- Format: `[text](url)` - separate text and URL
- Editing: Requires popup/modal for editing
- Paste behavior: Creates standard link with text and URL
- Use case: When you want different display text than the URL

### Link Highlight Plugin

- Format: `<url>` - URL only, displayed as-is
- Editing: Direct inline editing like code
- Paste behavior: Auto-highlights pasted URLs
- Click behavior: Opens link in new window (with Ctrl/Cmd+click modifier support)
- Use case: When you want to show the actual URL with highlighting
- Similar behavior to inline code but styled as a link

## Toolbar Integration

The `useEditorState` hook automatically detects which Link plugin is active and adapts accordingly:

```typescript
import { useEditorState } from '@lobehub/editor/react';
import { LinkIcon } from 'lucide-react';

function Toolbar({ editor }) {
  const editorState = useEditorState(editor);

  return (
    <button
      active={editorState.isLink} // Works for both Link and LinkHighlight
      onClick={editorState.insertLink} // Auto-adapts based on current selection
    >
      <LinkIcon />
    </button>
  );
}
```

**How it works:**

- When cursor is inside a `LinkHighlightNode`: Toggles it using `INSERT_LINK_HIGHLIGHT_COMMAND`
- When cursor is inside a `LinkNode`: Toggles it using `TOGGLE_LINK_COMMAND`
- When inserting a new link: Tries `INSERT_LINK_HIGHLIGHT_COMMAND` first, falls back to `TOGGLE_LINK_COMMAND` if not handled
- Toolbar button shows active state for both types of links
- Toolbar button automatically detects and uses the available plugin

### Using Both Plugins Together

If you want to use both Link and LinkHighlight plugins in the same editor:

```typescript
import { ReactEditor, ReactPlainText, ReactLinkPlugin, ReactLinkHighlightPlugin } from '@lobehub/editor';

function MyEditor() {
  return (
    <ReactEditor>
      {/* Standard Link plugin - disable hotkey to avoid conflict */}
      <ReactLinkPlugin enableHotkey={false} />

      {/* LinkHighlight plugin - uses Cmd+K hotkey */}
      <ReactLinkHighlightPlugin enableHotkey={true} />

      <ReactPlainText>
        <ReactEditorContent content={content} />
      </ReactPlainText>
    </ReactEditor>
  );
}
```

**Best Practices:**

- **Only enable one hotkey**: Both plugins use `Cmd/Ctrl+K` by default. Enable hotkey for only one plugin to avoid conflicts
- **Toolbar auto-detection**: The toolbar button (`editorState.insertLink`) tries LinkHighlight first, then falls back to standard Link
- **Plugin priority**: LinkHighlight is tried first when inserting new links. If you want Link plugin priority, only register Link plugin
- **LinkHighlight for pasting**: Enable `enablePasteAutoHighlight={true}` on LinkHighlight to auto-highlight pasted URLs
- **Link for manual entry**: Use Link plugin when you want different display text than the URL

**Recommended Configuration:**

```typescript
// For chat/messaging interfaces (auto-highlight URLs):
<ReactLinkHighlightPlugin enableHotkey={true} enablePasteAutoHighlight={true} />

// For documents (manual link creation with custom text):
<ReactLinkPlugin enableHotkey={true} />

// For both (LinkHighlight gets hotkey, Link disabled):
<ReactLinkPlugin enableHotkey={false} />
<ReactLinkHighlightPlugin enableHotkey={true} />
```

## Advanced Features

### Extracting URL from Node

```typescript
editor.update(() => {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    const node = selection.anchor.getNode();
    const linkHighlight = getLinkHighlightNode(node);
    if (linkHighlight) {
      const url = linkHighlight.getURL();
      console.log('Current link:', url);
    }
  }
});
```

### Integrating with Click Handlers

```typescript
// Add click handler to open links
editor.registerCommand(
  CLICK_COMMAND,
  (event) => {
    const node = $getNearestNodeFromDOMNode(event.target);
    if ($isLinkHighlightNode(node)) {
      const url = node.getURL();
      window.open(url, '_blank');
      return true;
    }
    return false;
  },
  COMMAND_PRIORITY_LOW,
);
```

### URL Validation

```typescript
// Add URL validation during creation
editor.registerNodeTransform(LinkHighlightNode, (node) => {
  const url = node.getURL();
  if (!isValidUrl(url)) {
    // Handle invalid URL
    node.remove();
  }
});
```
