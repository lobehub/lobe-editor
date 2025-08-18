---
nav: Plugins
group:
  title: Core
  order: -1
title: Markdown
description: Markdown plugin provides comprehensive markdown transformation and serialization capabilities. It includes markdown shortcuts, text formatting, element transformations, writer context system, and data source integration for seamless markdown import/export functionality.
---

## Introduction

Markdown plugin serves as the core markdown processing engine for the editor. It provides intelligent markdown shortcut transformations, comprehensive serialization capabilities, and a sophisticated transformer system that enables real-time markdown formatting as users type. The plugin supports text formatting, element transformations, and provides a writer context system for customizable markdown output.

## Core Architecture

### Markdown Shortcut Service

The plugin implements `IMarkdownShortCutService` for comprehensive markdown processing:

- **Transformer System**: Three types of transformers for different markdown elements
- **Real-time Processing**: Live markdown transformation as users type
- **Writer Registry**: Customizable markdown output formatting
- **Context Management**: Writer context system for structured output

### Transformer Types

#### ElementTransformer

Handles block-level markdown elements:

- **Element Creation**: Convert markdown patterns to editor nodes
- **Block Processing**: Handle headings, lists, code blocks, tables
- **Trigger Support**: Support for Enter key triggers
- **Import/Export**: Bidirectional markdown conversion

#### TextFormatTransformer

Handles inline text formatting:

- **Format Application**: Bold, italic, underline, code formatting
- **Tag Matching**: Opening and closing tag detection
- **Intraword Support**: Formatting within words
- **Multi-node Processing**: Cross-node formatting support

#### TextMatchTransformer

Handles pattern-based text replacements:

- **Pattern Matching**: Regex-based text transformations
- **Node Replacement**: Replace text with custom nodes
- **Import Handling**: Special import behavior configuration
- **Trigger Characters**: Single character activation

### Data Source Integration

- **MarkdownDataSource**: Integrated data source for markdown serialization
- **Writer Context**: Structured context for markdown generation
- **Node Processing**: Recursive node tree processing
- **Output Generation**: Clean markdown text output

## Plugin Configuration

### MarkdownPluginOptions

```typescript
interface MarkdownPluginOptions {
  // Currently no specific options required
  // Configuration is handled through service registration
}
```

## Service API

### IMarkdownShortCutService

Core service interface for markdown processing:

```typescript
interface IMarkdownShortCutService {
  registerMarkdownShortCut(transformer: Transformer): void;
  registerMarkdownShortCuts(transformers: Transformer[]): void;
  registerMarkdownWriter(
    type: string,
    writer: (ctx: IMarkdownWriterContext, node: LexicalNode) => void,
  ): void;
}
```

### Transformer Definitions

#### ElementTransformer

```typescript
interface ElementTransformer {
  regExp: RegExp;
  replace: (
    parentNode: ElementNode,
    children: Array<LexicalNode>,
    match: Array<string>,
    isImport: boolean,
  ) => boolean | void;
  trigger?: 'enter';
  type: 'element';
}
```

#### TextFormatTransformer

```typescript
interface TextFormatTransformer {
  format: ReadonlyArray<TextFormatType>;
  intraword?: boolean;
  tag: string;
  type: 'text-format';
}
```

#### TextMatchTransformer

```typescript
interface TextMatchTransformer {
  regExp: RegExp;
  replace?: (node: TextNode, match: RegExpMatchArray) => void | TextNode;
  trigger?: string;
  importRegExp?: RegExp;
  getEndIndex?: (node: TextNode, match: RegExpMatchArray) => number | false;
  type: 'text-match';
}
```

### Writer Context API

#### IMarkdownWriterContext

```typescript
interface IMarkdownWriterContext {
  appendLine: (line: string) => void;
  wrap: (before: string, after: string) => void;
  addProcessor(processor: (before: string, content: string, after: string) => string): void;
}
```

## Usage Examples

### Basic Plugin Setup

```typescript
const markdownPlugin = new MarkdownPlugin(kernel);

// The plugin automatically registers the markdown service
const markdownService = kernel.requireService(IMarkdownShortCutService);
```

### Registering Custom Transformers

```typescript
// Element transformer for custom blocks
const customBlockTransformer: ElementTransformer = {
  regExp: /^> (.+)$/,
  replace: (parentNode, children, match) => {
    const blockquoteNode = $createQuoteNode();
    blockquoteNode.append($createParagraphNode().append($createTextNode(match[1])));
    parentNode.replace(blockquoteNode);
    return true;
  },
  type: 'element',
};

// Text format transformer for custom formatting
const highlightTransformer: TextFormatTransformer = {
  format: ['highlight'],
  tag: '==',
  type: 'text-format',
};

// Text match transformer for custom replacements
const emojiTransformer: TextMatchTransformer = {
  regExp: /:smile:/g,
  replace: (textNode) => {
    textNode.setTextContent('😊');
  },
  trigger: ':',
  type: 'text-match',
};

// Register transformers
markdownService.registerMarkdownShortCuts([
  customBlockTransformer,
  highlightTransformer,
  emojiTransformer,
]);
```

### Custom Markdown Writers

```typescript
// Register custom writer for node type
markdownService.registerMarkdownWriter('custom-node', (ctx, node) => {
  if (isCustomNode(node)) {
    ctx.wrap('**', '**'); // Wrap content in bold
    // Process children will be handled automatically
  }
});

// Complex writer with processors
markdownService.registerMarkdownWriter('complex-node', (ctx, node) => {
  ctx.addProcessor((before, content, after) => {
    return `${before}<!-- Custom: ${content} -->${after}`;
  });
  ctx.appendLine(node.getTextContent());
});
```

### Transformer Registration Examples

```typescript
// Bold text transformer
const boldTransformer: TextFormatTransformer = {
  format: ['bold'],
  tag: '**',
  type: 'text-format',
};

// Heading transformer
const headingTransformer: ElementTransformer = {
  regExp: /^(#{1,6})\s(.+)$/,
  replace: (parentNode, children, match) => {
    const level = match[1].length as 1 | 2 | 3 | 4 | 5 | 6;
    const headingNode = $createHeadingNode(`h${level}`);
    headingNode.append($createTextNode(match[2]));
    parentNode.replace(headingNode);
    return true;
  },
  trigger: 'enter',
  type: 'element',
};

// Link transformer
const linkTransformer: TextMatchTransformer = {
  regExp: /\[([^\]]+)\]\(([^)]+)\)/,
  replace: (textNode, match) => {
    const linkNode = $createLinkNode(match[2]);
    linkNode.append($createTextNode(match[1]));
    textNode.replace(linkNode);
  },
  type: 'text-match',
};
```

### Data Source Integration

```typescript
// Get markdown output
const editor = kernel.getEditor();
const markdownContent = editor.getDocument('markdown');

// The markdown data source automatically processes all registered writers
console.log(markdownContent); // Clean markdown text output
```

### Advanced Writer Context Usage

```typescript
markdownService.registerMarkdownWriter('table', (ctx, node) => {
  if (isTableNode(node)) {
    const rows = getTableRows(node);

    rows.forEach((row, index) => {
      const cells = getTableCells(row);
      const cellContent = cells.map((cell) => cell.getTextContent()).join(' | ');
      ctx.appendLine(`| ${cellContent} |`);

      // Add header separator after first row
      if (index === 0) {
        const separator = cells.map(() => '---').join(' | ');
        ctx.appendLine(`| ${separator} |`);
      }
    });

    ctx.appendLine(''); // Empty line after table
  }
});
```

## Supported Markdown Features

### Text Formatting

- **Bold**: `**text**` or `__text__`
- **Italic**: `*text*` or `_text_`
- **Code**: `` `text` ``
- **Strikethrough**: `~~text~~`

### Block Elements

- **Headings**: `# H1`, `## H2`, etc.
- **Lists**: `- item`, `1. item`
- **Code Blocks**: ` `language \`\`\`
- **Blockquotes**: `> text`
- **Horizontal Rules**: `---`, `***`, `___`

### Advanced Features

- **Links**: `[text](url)`
- **Images**: `![alt](src)`
- **Tables**: Markdown table syntax
- **Custom Elements**: Extensible through transformers

The markdown plugin provides a robust foundation for all markdown processing in the editor, enabling seamless integration between visual editing and markdown format while maintaining full extensibility for custom markdown features.
