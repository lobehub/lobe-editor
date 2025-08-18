---
nav: Plugins
group: Plugins
title: Codeblock
description: Codeblock plugin provides advanced code syntax highlighting and editing capabilities. It integrates Shiki for beautiful syntax highlighting, supports multiple programming languages, custom themes, color replacements, and includes markdown shortcuts for easy code block creation.
atomId: ReactCodeblockPlugin
---

## Introduction

Codeblock plugin enhances the editor with professional code editing capabilities. It leverages Shiki for high-quality syntax highlighting, supports numerous programming languages, and provides extensive customization options including themes, color schemes, and language detection. The plugin includes markdown shortcuts for quick code block insertion and comprehensive command support for language switching.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Core Architecture

### Shiki Integration

The plugin uses Shiki for syntax highlighting:

- **Language Support**: Extensive language support through Shiki's bundled languages
- **Theme System**: Customizable themes with light/dark mode support
- **Tokenization**: Real-time syntax highlighting with customizable tokenizers
- **Color Replacements**: Dynamic color scheme modifications

### Node System

- **CodeNode**: Lexical's CodeNode for code block structure
- **CodeHighlightNode**: Individual syntax highlight tokens
- **Language Detection**: Automatic language detection from input patterns

### Command System

- **UPDATE_CODEBLOCK_LANG**: Change code block language
- **UPDATE_CODEBLOCK_COLOR_REPLACEMENTS**: Update syntax highlighting colors
- **Markdown Shortcuts**: \`\`\`language shortcuts for quick insertion

### Markdown Integration

- **Shortcut Support**: \`\`\`language pattern recognition
- **Export/Import**: Markdown serialization with language preservation
- **Tab Handling**: Proper indentation and tab character support

## Components

### ReactCodeblockPlugin

React component wrapper for code block functionality.

| Property | Description               | Type             | Default |
| -------- | ------------------------- | ---------------- | ------- |
| language | Default code language     | `string`         | -       |
| theme    | Syntax highlighting theme | `ShikiTheme`     | -       |
| onChange | Language change handler   | `(lang) => void` | -       |

## Commands

### UPDATE_CODEBLOCK_LANG

Change the language of the current code block:

```typescript
editor.dispatchCommand(UPDATE_CODEBLOCK_LANG, {
  lang: 'typescript',
});
```

### UPDATE_CODEBLOCK_COLOR_REPLACEMENTS

Update syntax highlighting colors:

```typescript
editor.dispatchCommand(UPDATE_CODEBLOCK_COLOR_REPLACEMENTS, {
  colorReplacements: {
    current: {
      string: '#ff6b6b',
      keyword: '#4ecdc4',
    },
  },
});
```

## Plugin Configuration

### CodeblockPluginOptions

| Property          | Description               | Type                                        | Default |
| ----------------- | ------------------------- | ------------------------------------------- | ------- |
| shikiTheme        | Shiki theme configuration | `string \| { dark: string, light: string }` | -       |
| colorReplacements | Custom color scheme       | `{ current?: AllColorReplacements }`        | -       |
| theme             | CSS theme configuration   | `{ code?: string }`                         | -       |

### AllColorReplacements

Color replacement configuration for customizing syntax highlighting:

```typescript
interface AllColorReplacements {
  [tokenType: string]: string; // CSS color values
}
```

## Supported Languages

The plugin supports all languages included in Shiki's `bundledLanguagesInfo`:

- JavaScript/TypeScript
- Python, Java, C++, C#
- HTML, CSS, SCSS
- Markdown, JSON, YAML
- Shell/Bash scripts
- And many more...

## Usage Examples

### Basic Setup

```typescript
const codeblockPlugin = new CodeblockPlugin(kernel, {
  shikiTheme: 'github-dark',
  theme: { code: 'custom-code-style' },
});
```

### Custom Theme Configuration

```typescript
const codeblockPlugin = new CodeblockPlugin(kernel, {
  shikiTheme: {
    light: 'github-light',
    dark: 'github-dark',
  },
  colorReplacements: {
    current: {
      string: '#22863a',
      keyword: '#d73a49',
      comment: '#6a737d',
    },
  },
});
```

### Language Detection

````typescript
// Markdown shortcut automatically detects language
// User types: ```typescript
// Creates code block with TypeScript highlighting
````

### Dynamic Language Switching

```typescript
// Change language of current code block
const changeLanguage = (newLang: string) => {
  editor.dispatchCommand(UPDATE_CODEBLOCK_LANG, { lang: newLang });
};
```
