<div align="center"><a name="readme-top"></a>

<img height="120" src="https://registry.npmmirror.com/@lobehub/assets-logo/1.0.0/files/assets/logo-3d.webp">
<img height="120" src="https://gw.alipayobjects.com/zos/kitchen/qJ3l3EPsdW/split.svg">
<img height="120" src="https://registry.npmmirror.com/@lobehub/fluent-emoji-3d/latest/files/assets/2712-fe0f.webp">

<h1>LobeHub Editor</h1>

A modern, extensible rich text editor built on Meta's Lexical framework with dual-architecture design, featuring both a powerful kernel and React integration. Optimized for AI applications and chat interfaces.

[![][npm-release-shield]][npm-release-link]
[![][github-releasedate-shield]][github-releasedate-link]
[![][github-action-test-shield]][github-action-test-link]
[![][github-action-release-shield]][github-action-release-link]<br/>
[![][github-contributors-shield]][github-contributors-link]
[![][github-forks-shield]][github-forks-link]
[![][github-stars-shield]][github-stars-link]
[![][github-issues-shield]][github-issues-link]
[![][github-license-shield]][github-license-link]

[Changelog](./CHANGELOG.md) · [Report Bug][github-issues-link] · [Request Feature][github-issues-link]

![](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

</div>

<details>
<summary><kbd>Table of contents</kbd></summary>

#### TOC

- [✨ Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
  - [Basic Editor](#basic-editor)
  - [Advanced Usage with Plugins](#advanced-usage-with-plugins)
  - [Chat Input Component](#chat-input-component)
  - [Editor Kernel API](#editor-kernel-api)
- [🔌 Available Plugins](#-available-plugins)
- [📖 API Reference](#-api-reference)
  - [Editor Kernel](#editor-kernel)
  - [Plugin System](#plugin-system)
- [🛠️ Development](#️-development)
  - [Setup](#setup)
  - [Available Scripts](#available-scripts)
  - [Project Architecture](#project-architecture)
- [🤝 Contributing](#-contributing)
- [🔗 Links](#-links)
  - [More Products](#more-products)
  - [Design Resources](#design-resources)
  - [Development Resources](#development-resources)

####

</details>

## ✨ Features

- 🎯 **Dual Architecture** - Both kernel-based API and React components for maximum flexibility
- ⚛️ **React-First** - Built for React 19+ with modern hooks and patterns
- 🔌 **Rich Plugin Ecosystem** - 10+ built-in plugins for comprehensive content editing
- 💬 **Chat Interface Ready** - Pre-built chat input components with mention support
- ⌨️ **Slash Commands** - Intuitive `/` and `@` triggered menus for quick content insertion
- 📝 **Multiple Export Formats** - JSON, Markdown, and plain text export capabilities
- 🎨 **Customizable UI** - Antd-styled components with flexible theming
- 🔗 **File & Media Support** - Native support for images, files, tables, and more
- 🎯 **TypeScript Native** - Built with TypeScript for excellent developer experience
- 📱 **Modern Build System** - Optimized with Vite, Dumi docs, and comprehensive testing

## 📦 Installation

To install `@lobehub/editor`, run the following command:

[![][bun-shield]][bun-link]

```bash
$ bun add @lobehub/editor
```

```bash
$ npm install @lobehub/editor
```

```bash
$ pnpm add @lobehub/editor
```

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🚀 Quick Start

### Basic Editor

The simplest way to get started with a fully-featured editor:

```tsx
import {
  ReactCodeblockPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
} from '@lobehub/editor';
import { Editor } from '@lobehub/editor/react';

export default function MyEditor() {
  const editorRef = Editor.useEditor();

  return (
    <Editor
      placeholder="Start typing..."
      editorRef={editorRef}
      plugins={[ReactListPlugin, ReactLinkPlugin, ReactImagePlugin, ReactCodeblockPlugin]}
      slashOption={{
        items: [
          {
            key: 'h1',
            label: 'Heading 1',
            onSelect: (editor) => {
              editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h1' });
            },
          },
          // More slash commands...
        ],
      }}
      onChange={(editor) => {
        // Handle content changes
        const markdown = editor.getDocument('markdown');
        const json = editor.getDocument('json');
      }}
    />
  );
}
```

### Advanced Usage with Plugins

Add more functionality with built-in plugins:

```tsx
import {
  INSERT_FILE_COMMAND,
  INSERT_TABLE_COMMAND,
  ReactFilePlugin,
  ReactHRPlugin,
  ReactTablePlugin,
} from '@lobehub/editor';
import { Editor } from '@lobehub/editor/react';

export default function AdvancedEditor() {
  const editorRef = Editor.useEditor();

  return (
    <Editor
      editorRef={editorRef}
      plugins={[
        ReactTablePlugin,
        ReactHRPlugin,
        Editor.withProps(ReactFilePlugin, {
          handleUpload: async (file) => {
            // Handle file upload
            return { url: await uploadFile(file) };
          },
        }),
      ]}
      mentionOption={{
        items: async (search) => [
          {
            key: 'user1',
            label: 'John Doe',
            onSelect: (editor) => {
              editor.dispatchCommand(INSERT_MENTION_COMMAND, {
                label: 'John Doe',
                extra: { userId: 1 },
              });
            },
          },
        ],
      }}
    />
  );
}
```

### Chat Input Component

Pre-built component optimized for chat interfaces:

```tsx
import { ChatInput } from '@lobehub/editor/react';

export default function ChatApp() {
  return (
    <ChatInput
      placeholder="Type a message..."
      onSend={(content) => {
        // Handle message send
        console.log('Message:', content);
      }}
      enabledFeatures={['mention', 'upload', 'codeblock']}
    />
  );
}
```

### Editor Kernel API

For advanced use cases, access the underlying kernel directly:

```typescript
import { IEditor, createEditor } from '@lobehub/editor';

// Create editor instance
const editor: IEditor = createEditor();

// Register plugins
editor.registerPlugin(SomePlugin, { config: 'value' });

// Interact with content
editor.setDocument('text', 'Hello world');
const content = editor.getDocument('json');

// Listen to events
editor.on('content-changed', (newContent) => {
  console.log('Content updated:', newContent);
});

// Execute commands
editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h2' });
```

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔌 Available Plugins

| Plugin                   | Description               | Features                                                        |
| ------------------------ | ------------------------- | --------------------------------------------------------------- |
| **ReactSlashPlugin**     | Slash command menu system | `/` and `@` triggered menus, customizable items, async search   |
| **ReactMentionPlugin**   | User mention support      | `@username` mentions, custom markdown output, async user search |
| **ReactImagePlugin**     | Image handling            | Upload, display, drag & drop, multiple formats                  |
| **ReactCodeblockPlugin** | Code syntax highlighting  | Shiki-powered, 100+ languages, copy button                      |
| **ReactListPlugin**      | List management           | Ordered/unordered lists, nested lists, keyboard shortcuts       |
| **ReactLinkPlugin**      | Link management           | Auto-detection, custom link creation, URL validation            |
| **ReactTablePlugin**     | Table support             | Insert tables, edit cells, add/remove rows/columns              |
| **ReactHRPlugin**        | Horizontal rules          | Divider insertion, custom styling                               |
| **ReactFilePlugin**      | File attachments          | File upload, custom upload handlers, markdown export            |
| **ReactUploadPlugin**    | Generic upload handling   | Drag & drop, multiple file types, progress tracking             |

All plugins are:

- ✅ **Fully configurable** with TypeScript-typed options
- ✅ **Composable** - use any combination together
- ✅ **Extensible** - create custom plugins using the same API
- ✅ **Event-driven** - react to user interactions and content changes

## 📖 API Reference

#### Utility Hooks

```tsx
// Get editor reference
const editorRef = Editor.useEditor();

// Helper for plugin configuration
const PluginWithConfig = Editor.withProps(ReactFilePlugin, {
  handleUpload: async (file) => ({ url: 'uploaded-url' }),
});
```

### Editor Kernel

#### `createEditor(): IEditor`

Create a new editor kernel instance:

```typescript
const editor = createEditor();
```

#### `IEditor` Interface

Core editor methods:

```typescript
interface IEditor {
  // Content management
  setDocument(type: string, content: any): void;
  getDocument(type: string): any;

  // Plugin system
  registerPlugin<T>(plugin: Constructor<T>, config?: T): IEditor;
  registerPlugins(plugins: Plugin[]): IEditor;

  // Commands
  dispatchCommand<T>(command: LexicalCommand<T>, payload: T): boolean;

  // Events
  on<T>(event: string, listener: (data: T) => void): this;
  off<T>(event: string, listener: (data: T) => void): this;

  // Lifecycle
  focus(): void;
  blur(): void;
  destroy(): void;

  // Access
  getLexicalEditor(): LexicalEditor | null;
  getRootElement(): HTMLElement | null;
  requireService<T>(serviceId: ServiceID<T>): T | null;
}
```

### Plugin System

#### Creating Custom Plugins

```typescript
import { IEditorKernel, IEditorPlugin } from '@lobehub/editor';

class MyCustomPlugin implements IEditorPlugin {
  constructor(private config: MyPluginConfig) {}

  initialize(kernel: IEditorKernel) {
    // Register nodes, commands, transforms, etc.
    kernel.registerNode(MyCustomNode);
    kernel.registerCommand(MY_COMMAND, this.handleCommand);
  }

  destroy() {
    // Cleanup
  }
}
```

#### Available Commands

Common commands you can dispatch:

```typescript
// Content insertion
INSERT_HEADING_COMMAND; // { tag: 'h1' | 'h2' | 'h3' }
INSERT_LINK_COMMAND; // { url: string, text?: string }
INSERT_IMAGE_COMMAND; // { src: string, alt?: string }
INSERT_TABLE_COMMAND; // { rows: number, columns: number }
INSERT_MENTION_COMMAND; // { label: string, extra?: any }
INSERT_FILE_COMMAND; // { file: File }
INSERT_HORIZONTAL_RULE_COMMAND;

// Text formatting
FORMAT_TEXT_COMMAND; // { format: 'bold' | 'italic' | 'underline' }
CLEAR_FORMAT_COMMAND;
```

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🛠️ Development

### Setup

You can use Github Codespaces for online development:

[![][github-codespace-shield]][github-codespace-link]

Or clone it for local development:

[![][bun-shield]][bun-link]

```bash
$ git clone https://github.com/lobehub/lobe-editor.git
$ cd lobe-editor
$ pnpm install
$ pnpm run dev
```

This will start the Dumi documentation server with live playground at `http://localhost:8000`.

### Available Scripts

| Script               | Description                                   |
| -------------------- | --------------------------------------------- |
| `pnpm dev`           | Start Dumi development server with playground |
| `pnpm build`         | Build library and generate type definitions   |
| `pnpm test`          | Run tests with Vitest                         |
| `pnpm test:coverage` | Run tests with coverage report                |
| `pnpm lint`          | Lint and fix code with ESLint                 |
| `pnpm type-check`    | Type check with TypeScript                    |
| `pnpm ci`            | Run all CI checks (lint, type-check, test)    |
| `pnpm docs:build`    | Build documentation for production            |
| `pnpm release`       | Publish new version with semantic-release     |

### Project Architecture

```
lobe-editor/
├── src/
│   ├── editor-kernel/           # 🧠 Core editor logic
│   │   ├── kernel.ts           # Main editor class with plugin system
│   │   ├── data-source.ts      # Content management (JSON/Markdown/Text)
│   │   ├── react/              # React integration layer
│   │   └── types.ts            # TypeScript interfaces
│   │
│   ├── plugins/                # 🔌 Feature plugins
│   │   ├── common/             # Base editing (PlainText, EditorContent)
│   │   ├── slash/              # Slash commands (/, @)
│   │   ├── mention/            # @mention system
│   │   ├── image/              # Image upload & display
│   │   ├── codeblock/          # Syntax highlighting
│   │   ├── table/              # Table support
│   │   ├── file/               # File attachments
│   │   ├── link/               # Link management
│   │   ├── list/               # Lists (ordered/unordered)
│   │   ├── hr/                 # Horizontal rules
│   │   └── upload/             # Generic upload handling
│   │
│   ├── react/                  # ⚛️ High-level React components
│   │   ├── Editor/             # Main Editor component
│   │   ├── ChatInput/          # Chat interface component
│   │   └── ChatInputActions/   # Chat action buttons
│   │
│   └── index.ts                # Public API exports
│
├── docs/                       # 📚 Documentation source
├── tests/                      # 🧪 Test files
├── vitest.config.ts           # Test configuration
└── .dumi/                      # Dumi doc build cache
```

The architecture follows a **dual-layer design**:

1. **Kernel Layer** (`editor-kernel/`) - Framework-agnostic core with plugin system
2. **React Layer** (`react/` + `plugins/*/react/`) - React-specific implementations

This allows for maximum flexibility - you can use just the kernel for custom integrations, or the React components for rapid development.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🤝 Contributing

Contributions of all types are more than welcome, if you are interested in contributing code, feel free to check out our GitHub [Issues][github-issues-link] to get stuck in to show us what you're made of.

[![][pr-welcome-shield]][pr-welcome-link]

[![][github-contrib-shield]][github-contrib-link]

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔗 Links

### More Products

- **[🤯 Lobe Chat](https://github.com/lobehub/lobe-chat)** - An open-source, extensible (Function Calling), high-performance chatbot framework. It supports one-click free deployment of your private ChatGPT/LLM web application.
- **[🅰️ Lobe Theme](https://github.com/lobehub/sd-webui-lobe-theme)** - The modern theme for stable diffusion webui, exquisite interface design, highly customizable UI, and efficiency boosting features.
- **[🧸 Lobe Vidol](https://github.com/lobehub/lobe-vidol)** - Experience the magic of virtual idol creation with Lobe Vidol, enjoy the elegance of our Exquisite UI Design, dance along using MMD Dance Support, and engage in Smooth Conversations.

### Design Resources

- **[🍭 Lobe UI](https://ui.lobehub.com)** - An open-source UI component library for building AIGC web apps.
- **[🥨 Lobe Icons](https://lobehub.com/icons)** - Popular AI / LLM Model Brand SVG Logo and Icon Collection.
- **[📊 Lobe Charts](https://charts.lobehub.com)** - React modern charts components built on recharts

### Development Resources

- **[🎤 Lobe TTS](https://tts.lobehub.com)** - A high-quality & reliable TTS/STT library for Server and Browser
- **[🌏 Lobe i18n](https://github.com/lobehub/lobe-cli-toolbox/blob/master/packages/lobe-i18n)** - Automation ai tool for the i18n (internationalization) translation process.

[More Resources](https://lobehub.com/resources)

<div align="right">

[![][back-to-top]](#readme-top)

</div>

---

#### 📝 License

Copyright © 2025 [LobeHub][profile-link]. <br />
This project is [MIT](./LICENSE) licensed.

[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-black?style=flat-square
[bun-link]: https://bun.sh
[bun-shield]: https://img.shields.io/badge/-speedup%20with%20bun-black?logo=bun&style=for-the-badge
[github-action-release-link]: https://github.com/lobehub/lobe-editor/actions/workflows/release.yml
[github-action-release-shield]: https://img.shields.io/github/actions/workflow/status/lobehub/lobe-editor/release.yml?label=release&labelColor=black&logo=githubactions&logoColor=white&style=flat-square
[github-action-test-link]: https://github.com/lobehub/lobe-editor/actions/workflows/test.yml
[github-action-test-shield]: https://img.shields.io/github/actions/workflow/status/lobehub/lobe-editor/test.yml?label=test&labelColor=black&logo=githubactions&logoColor=white&style=flat-square
[github-codespace-link]: https://codespaces.new/lobehub/lobe-editor
[github-codespace-shield]: https://github.com/codespaces/badge.svg
[github-contrib-link]: https://github.com/lobehub/lobe-editor/graphs/contributors
[github-contrib-shield]: https://contrib.rocks/image?repo=lobehub%2Flobe-editor
[github-contributors-link]: https://github.com/lobehub/lobe-editor/graphs/contributors
[github-contributors-shield]: https://img.shields.io/github/contributors/lobehub/lobe-editor?color=c4f042&labelColor=black&style=flat-square
[github-forks-link]: https://github.com/lobehub/lobe-editor/network/members
[github-forks-shield]: https://img.shields.io/github/forks/lobehub/lobe-editor?color=8ae8ff&labelColor=black&style=flat-square
[github-issues-link]: https://github.com/lobehub/lobe-editor/issues
[github-issues-shield]: https://img.shields.io/github/issues/lobehub/lobe-editor?color=ff80eb&labelColor=black&style=flat-square
[github-license-link]: https://github.com/lobehub/lobe-editor/blob/master/LICENSE
[github-license-shield]: https://img.shields.io/github/license/lobehub/lobe-editor?color=white&labelColor=black&style=flat-square
[github-releasedate-link]: https://github.com/lobehub/lobe-editor/releases
[github-releasedate-shield]: https://img.shields.io/github/release-date/lobehub/lobe-editor?labelColor=black&style=flat-square
[github-stars-link]: https://github.com/lobehub/lobe-editor/network/stargazers
[github-stars-shield]: https://img.shields.io/github/stars/lobehub/lobe-editor?color=ffcb47&labelColor=black&style=flat-square
[npm-release-link]: https://www.npmjs.com/package/@lobehub/editor
[npm-release-shield]: https://img.shields.io/npm/v/@lobehub/editor?color=369eff&labelColor=black&logo=npm&logoColor=white&style=flat-square
[pr-welcome-link]: https://github.com/lobehub/lobe-editor/pulls
[pr-welcome-shield]: https://img.shields.io/badge/%F0%9F%A4%AF%20PR%20WELCOME-%E2%86%92-ffcb47?labelColor=black&style=for-the-badge
[profile-link]: https://github.com/lobehub
