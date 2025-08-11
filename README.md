<div align="center"><a name="readme-top"></a>

<img height="120" src="https://registry.npmmirror.com/@lobehub/assets-logo/1.0.0/files/assets/logo-3d.webp">
<img height="120" src="https://gw.alipayobjects.com/zos/kitchen/qJ3l3EPsdW/split.svg">
<img height="120" src="https://registry.npmmirror.com/@lobehub/fluent-emoji-3d/latest/files/assets/2712-fe0f.webp">

<h1>LobeHub Editor</h1>

A powerful and extensible rich text editor built on Meta's Lexical framework, providing a modern editing experience with React integration.

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
  - [Basic React Editor](#basic-react-editor)
  - [With Plugins](#with-plugins)
  - [Editor Kernel Usage](#editor-kernel-usage)
- [🔌 Available Plugins](#-available-plugins)
- [📖 API Reference](#-api-reference)
  - [Editor Kernel](#editor-kernel)
  - [React Components](#react-components)
  - [Plugin System](#plugin-system)
- [🛠️ Development](#️-development)
  - [Available Scripts](#available-scripts)
  - [Project Structure](#project-structure)
- [🤝 Contributing](#-contributing)
- [🔗 Links](#-links)
  - [More Products](#more-products)
  - [Design Resources](#design-resources)
  - [Development Resources](#development-resources)

####

</details>

## ✨ Features

- 🎯 **Lexical-Powered** - Built on Meta's robust Lexical framework for reliable rich text editing
- ⚛️ **React Integration** - First-class React support with hooks and components
- 🔌 **Plugin System** - Extensible architecture with modular plugins
- 🎨 **Rich Content** - Support for images, code blocks, links, lists, and more
- ⌨️ **Slash Commands** - Quick content insertion with customizable slash menu
- 🎯 **TypeScript** - Full TypeScript support for better developer experience
- 🧪 **Testing Ready** - Comprehensive test setup with Vitest
- 📦 **Modern Build** - Optimized build with Vite supporting ES, UMD, and CJS formats

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

### Basic React Editor

```tsx
import { ReactEditor, ReactEditorContent, ReactPlainText } from '@lobehub/editor';
import React from 'react';

function MyEditor() {
  return (
    <ReactEditor>
      <ReactPlainText
        style={{
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '10px',
          minHeight: '200px',
        }}
      >
        <ReactEditorContent
          content={{
            root: {
              children: [
                {
                  children: [
                    {
                      detail: 0,
                      format: 0,
                      mode: 'normal',
                      style: '',
                      text: 'Start typing...',
                      type: 'text',
                      version: 1,
                    },
                  ],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  type: 'paragraph',
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              type: 'root',
              version: 1,
            },
          }}
        />
      </ReactPlainText>
    </ReactEditor>
  );
}
```

### With Plugins

```tsx
import {
  ReactCodeblockPlugin,
  ReactEditor,
  ReactEditorContent,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactPlainText,
  ReactSlashOption,
  ReactSlashPlugin,
} from '@lobehub/editor';
import React from 'react';

function AdvancedEditor() {
  return (
    <ReactEditor>
      <ReactSlashPlugin>
        <ReactSlashOption
          items={[
            { label: 'Heading 1', value: 'h1' },
            { label: 'Code Block', value: 'code' },
            { label: 'Image', value: 'image' },
          ]}
          trigger="/"
        />
      </ReactSlashPlugin>
      <ReactImagePlugin />
      <ReactCodeblockPlugin />
      <ReactListPlugin />
      <ReactLinkPlugin />

      <ReactPlainText>
        <ReactEditorContent content={initialContent} />
      </ReactPlainText>
    </ReactEditor>
  );
}
```

### Editor Kernel Usage

For more advanced use cases, you can use the editor kernel directly:

```typescript
import Editor, { IEditor } from '@lobehub/editor';

// Create editor instance
const editor: IEditor = Editor.createEditor();

// Register plugins
editor.registerPlugin(somePlugin);

// Use editor methods
const content = editor.getContent();
editor.setContent(newContent);
```

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔌 Available Plugins

- **ReactSlashPlugin** - Slash command menu for quick content insertion
- **ReactImagePlugin** - Image upload and display support
- **ReactCodeblockPlugin** - Syntax-highlighted code blocks
- **ReactListPlugin** - Ordered and unordered lists
- **ReactLinkPlugin** - Link creation and editing
- **ReactHRPlugin** - Horizontal rule dividers

Each plugin can be configured and customized to fit your needs.

## 📖 API Reference

### Editor Kernel

#### `Editor.createEditor(): IEditor`

Creates a new editor instance with the core functionality.

#### `IEditor` Interface

- `registerPlugin(plugin: IEditorPlugin): void` - Register a plugin
- `getContent(): any` - Get current editor content
- `setContent(content: any): void` - Set editor content
- `destroy(): void` - Clean up editor instance

### React Components

#### `ReactEditor`

The main wrapper component that provides the Lexical context.

```tsx
<ReactEditor>{/* Editor plugins and content */}</ReactEditor>
```

#### `ReactPlainText`

A text input area component.

```tsx
<ReactPlainText style={{ border: '1px solid #ccc' }}>
  <ReactEditorContent content={content} />
</ReactPlainText>
```

#### `ReactEditorContent`

Component for setting initial content.

```tsx
<ReactEditorContent content={lexicalContentObject} />
```

### Plugin System

Plugins follow a consistent pattern and can be composed together:

```tsx
<ReactEditor>
  <ReactSlashPlugin>
    <ReactSlashOption items={menuItems} trigger="/" />
  </ReactSlashPlugin>
  <ReactImagePlugin />
  <ReactCodeblockPlugin />
</ReactEditor>
```

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🛠️ Development

You can use Github Codespaces for online development:

[![][github-codespace-shield]][github-codespace-link]

Or clone it for local development:

[![][bun-shield]][bun-link]

```bash
$ git clone https://github.com/lobehub/lobe-editor.git
$ cd lobe-editor
$ bun install
$ bun dev
```

### Available Scripts

- `pnpm run dev` - Start development server with playground
- `pnpm run build` - Build the library for production
- `pnpm run test` - Run tests with Vitest
- `pnpm run test:coverage` - Run tests with coverage report
- `pnpm run lint` - Lint and fix code
- `pnpm run type-check` - Type check TypeScript code
- `pnpm run ci` - Run all CI checks

### Project Structure

```
lobe-editor/
├── src/
│   ├── editor-kernel/        # Core editor functionality
│   │   ├── react/           # React integration
│   │   ├── kernel.ts        # Main editor kernel
│   │   └── types.ts         # TypeScript definitions
│   ├── plugins/             # Editor plugins
│   │   ├── common/          # Basic editor functionality
│   │   ├── slash/           # Slash command plugin
│   │   ├── image/           # Image plugin
│   │   ├── codeblock/       # Code block plugin
│   │   ├── list/            # List plugin
│   │   └── link/            # Link plugin
│   ├── index.ts             # Main library entry point
│   └── playground.tsx       # Development playground
├── dist/                    # Built files (generated)
├── playground/              # Playground HTML
├── vite.config.js           # Build configuration
├── vitest.config.ts         # Test configuration
└── package.json             # Package configuration
```

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

