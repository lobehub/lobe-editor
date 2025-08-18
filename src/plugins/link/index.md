---
nav: Plugins
group: Plugins
title: Link
description: Link plugin provides comprehensive hyperlink functionality with internationalization support. It includes link creation, editing, validation, custom link nodes, utility functions, and React components for building rich link editing experiences with auto-detection and formatting.
atomId: ReactLinkPlugin
---

## Introduction

Link plugin enables advanced hyperlink functionality in the editor. It supports link insertion, editing, URL validation, and provides a sophisticated link node system with serialization capabilities. The plugin includes internationalization support, auto-link detection, custom styling options, and React components for seamless link integration with preview and editing features.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Core Architecture

### Link Node System

The plugin implements custom link nodes:

- **LinkNode**: Custom node extending Lexical's LinkNode with enhanced features
- **URL Validation**: Built-in URL validation and formatting
- **Target Support**: Support for link targets (\_blank, \_self, etc.)
- **Serialization**: JSON serialization for persistence and transport

### Command System

- **Link Commands**: Create, edit, and remove link operations
- **Auto-detection**: Automatic link detection during typing
- **Validation Commands**: URL validation and format correction

### Internationalization

- **i18n Support**: Built-in internationalization for link-related text
- **Localized Labels**: Translatable link commands and interface elements
- **Multiple Languages**: Support for various locales and languages

### Link Features

- **Auto-detection**: Automatic URL detection and conversion
- **Link Preview**: Rich link previews with metadata
- **Target Options**: Configurable link targets and behaviors
- **Validation**: URL format validation and correction
- **Custom Styling**: Flexible link appearance customization

## Components

### ReactLinkPlugin

React component wrapper for link functionality.

| Property    | Description                | Type                                         | Default   |
| ----------- | -------------------------- | -------------------------------------------- | --------- |
| href        | Link URL                   | `string`                                     | -         |
| target      | Link target                | `'_blank' \| '_self' \| '_parent' \| '_top'` | `'_self'` |
| title       | Link title attribute       | `string`                                     | -         |
| rel         | Link relationship          | `string`                                     | -         |
| autoDetect  | Enable auto-link detection | `boolean`                                    | `true`    |
| validate    | Enable URL validation      | `boolean`                                    | `true`    |
| preview     | Enable link preview        | `boolean`                                    | `false`   |
| onLinkClick | Link click event handler   | `(url: string) => void`                      | -         |
| onLinkEdit  | Link edit event handler    | `(link: LinkData) => void`                   | -         |

## Commands

### Link Commands

```typescript
// Create or update a link
editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
  url: 'https://example.com',
  target: '_blank',
  title: 'Example Website',
});

// Remove link
editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
```

## Plugin Configuration

### LinkPluginOptions

| Property         | Description                     | Type        | Default             |
| ---------------- | ------------------------------- | ----------- | ------------------- |
| theme            | Link CSS theme configuration    | `LinkTheme` | -                   |
| autoDetect       | Enable automatic link detection | `boolean`   | `true`              |
| validateOnType   | Validate URLs while typing      | `boolean`   | `true`              |
| defaultTarget    | Default link target             | `string`    | `'_self'`           |
| allowedProtocols | Allowed URL protocols           | `string[]`  | `['http', 'https']` |

### LinkTheme

CSS theme configuration for link styling:

```typescript
interface LinkTheme {
  link?: string;
  linkHover?: string;
  linkActive?: string;
  linkInvalid?: string;
  linkPreview?: string;
}
```

## Utility Functions

### Link Operations

```typescript
// URL validation
isValidUrl(url: string): boolean
normalizeUrl(url: string): string

// Link detection
detectLinks(text: string): LinkMatch[]
autoLinkText(text: string): string

// Link formatting
formatLinkTitle(url: string): string
extractDomain(url: string): string

// Link node helpers
isLinkNode(node: LexicalNode): boolean
getLinkUrl(node: LinkNode): string
setLinkUrl(node: LinkNode, url: string): void
```

### Auto-detection

```typescript
// Pattern matching for URLs
const URL_PATTERN = /https?:\/\/[^\s]+/g;

// Auto-link transformer
const AUTO_LINK_TRANSFORMER = {
  dependencies: [LinkNode],
  export: (node: LinkNode) => {
    return `[${node.getTextContent()}](${node.getURL()})`;
  },
  importRegExp: /\[([^\]]+)\]\(([^)]+)\)/,
  regExp: URL_PATTERN,
  replace: (textNode, match) => {
    const url = match[0];
    const linkNode = $createLinkNode(url);
    linkNode.append($createTextNode(url));
    return linkNode;
  },
  trigger: ' ',
  type: 'text-match',
};
```

## Internationalization

The plugin includes i18n support for link-related text:

```typescript
// Example translations
{
  "link.insert": "Insert Link",
  "link.edit": "Edit Link",
  "link.remove": "Remove Link",
  "link.url": "URL",
  "link.title": "Link Title",
  "link.target": "Link Target",
  "link.openNewWindow": "Open in New Window",
  "link.invalidUrl": "Invalid URL format",
  "link.preview": "Link Preview"
}
```

## Usage Examples

### Basic Link Setup

```typescript
const linkPlugin = new LinkPlugin(kernel, {
  theme: {
    link: 'custom-link',
    linkHover: 'custom-link-hover',
    linkInvalid: 'custom-link-invalid',
  },
  autoDetect: true,
  validateOnType: true,
  defaultTarget: '_blank',
  allowedProtocols: ['http', 'https', 'mailto'],
});
```

### Manual Link Creation

```typescript
// Create link from selection
const createLink = (url: string, title?: string) => {
  editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
    url: normalizeUrl(url),
    title,
    target: '_blank',
  });
};

// Edit existing link
const editLink = (newUrl: string) => {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const node = getSelectedNode(selection);
      const linkNode = $findMatchingParent(node, $isLinkNode);
      if (linkNode) {
        linkNode.setURL(normalizeUrl(newUrl));
      }
    }
  });
};
```

### Auto-link Detection

```typescript
// Enable auto-link detection
const autoLinkPlugin = new AutoLinkPlugin({
  matchers: [
    (text: string) => {
      const matches = text.match(URL_PATTERN);
      return (
        matches?.map((match) => ({
          index: text.indexOf(match),
          length: match.length,
          text: match,
          url: match,
        })) || []
      );
    },
  ],
});
```

### Custom Link Component

```typescript
const CustomLinkComponent = ({ node, children }) => {
  const [showPreview, setShowPreview] = useState(false);
  const url = node.getURL();
  const target = node.getTarget();

  return (
    <span
      className="custom-link-wrapper"
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
    >
      <a
        href={url}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        className="custom-link"
      >
        {children}
      </a>
      {showPreview && (
        <div className="link-preview">
          <strong>{extractDomain(url)}</strong>
          <br />
          {url}
        </div>
      )}
    </span>
  );
};
```

### Link Validation

```typescript
const validateAndCreateLink = (url: string) => {
  if (!isValidUrl(url)) {
    // Try to fix common issues
    const normalizedUrl = normalizeUrl(url);
    if (isValidUrl(normalizedUrl)) {
      createLink(normalizedUrl);
    } else {
      showError('Invalid URL format');
    }
  } else {
    createLink(url);
  }
};
```
