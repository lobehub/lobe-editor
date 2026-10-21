<div align="center"><a name="readme-top"></a>

<img height="120" src="https://raw.githubusercontent.com/lobehub/lobe-assets/master/packages/assets-logo/assets/logo-3d.webp">
<img height="120" src="https://raw.githubusercontent.com/lobehub/lobe-assets/master/packages/assets-logo/assets/split.svg">
<img height="120" src="https://raw.githubusercontent.com/lobehub/fluent-emoji/master/packages/3d/assets/2712-fe0f.webp">

<h1>LobeHub Editor</h1>

<h3>One editor for chat, documents and AI edits.</h3>

A rich text editor for React, built on Meta's Lexical, for developers building AI apps: chat composers, Markdown documents and agent-driven editing.

[![][npm-release-shield]][npm-release-link]
[![][github-releasedate-shield]][github-releasedate-link]
[![][github-action-test-shield]][github-action-test-link]
[![][github-action-release-shield]][github-action-release-link]<br/>
[![][github-contributors-shield]][github-contributors-link]
[![][github-forks-shield]][github-forks-link]
[![][github-stars-shield]][github-stars-link]
[![][github-issues-shield]][github-issues-link]
[![][github-license-shield]][github-license-link]

[Documentation](https://editor.lobehub.com) · [Changelog](./CHANGELOG.md) · [Report Bug][github-issues-link] · [Request Feature][github-issues-link]

![](https://github.com/user-attachments/assets/98c9a810-1c7d-4c33-acd7-ae9d4c0695da)

</div>

<details>
<summary><kbd>Table of contents</kbd></summary>

#### TOC

- [💡 Why Lobe Editor?](#-why-lobe-editor)
- [🚀 Getting Started](#-getting-started)
- [🤖 AI-Powered Development](#-ai-powered-development)
- [👥 Who is this for?](#-who-is-this-for)
- [📦 Entry Points](#-entry-points)
- [📚 Documentation](#-documentation)
- [🛠️ Local Development](#️-local-development)
- [🤝 Contributing](#-contributing)
- [🔗 Links](#-links)

####

</details>

## 💡 Why Lobe Editor?

Lobe Editor (`@lobehub/editor`) is a drop-in rich text editor for React apps that talk to AI, from chat input boxes to full documents.

- **Ready for chat** — A chat composer with slash commands, `@` mentions, attachments and a send button, ready to drop in
- **Markdown in, Markdown out** — Type Markdown shortcuts, paste Markdown, and get clean Markdown or JSON back
- **Let AI edit safely** — Models can change the document while users review and accept or reject each change
- **Rich content** — Tables, code blocks, math, images, files, links, lists and collapsible sections
- **Works beyond the browser** — Process content on the server, render it read-only (SSR-friendly), and collaborate in real time
- **AI-native** — [`skills.md`](https://editor.lobehub.com/skills.md) and [`llms.txt`](https://editor.lobehub.com/llms.txt) let coding agents use the editor correctly

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🚀 Getting Started

[![][bun-shield]][bun-link]

```bash
$ bun add @lobehub/editor
# or
$ pnpm add @lobehub/editor
```

Requires React 19 and the peer dependencies `react`, `react-dom`, `@lobehub/ui` and `motion`.

A minimal editor with lists, links and code blocks:

```tsx
import { ReactCodeblockPlugin, ReactLinkPlugin, ReactListPlugin } from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';

export default function MyEditor() {
  const editor = useEditor();

  return (
    <Editor
      editor={editor}
      placeholder="Type / for commands..."
      plugins={[ReactListPlugin, ReactLinkPlugin, ReactCodeblockPlugin]}
      onTextChange={(editor) => {
        console.log(editor.getDocument('markdown'));
      }}
    />
  );
}
```

Next steps:

- [Editor](https://editor.lobehub.com/components/react/editor) — props, plugins, mentions and slash menus
- [ChatInput](https://editor.lobehub.com/components/react/chat-input) — build a chat composer
- [Components](https://editor.lobehub.com/components) — all components, plugins and renderers

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🤖 AI-Powered Development

Lobe Editor is built for AI-assisted development. The docs site publishes machine-readable references, so agents use real props and APIs instead of guessing.

| Resource          | What it does                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agent Skills**  | [editor.lobehub.com/skills.md](https://editor.lobehub.com/skills.md) — setup, workflow and an index of every component and plugin. Give this URL to your agent in Cursor, Claude Code, Codex and others |
| **llms.txt**      | [editor.lobehub.com/llms.txt](https://editor.lobehub.com/llms.txt) — structured page index with descriptions and outlines for LLMs                                                                      |
| **Markdown docs** | Every docs page has a `.md` version, e.g. [Editor](https://editor.lobehub.com/skills/components/react/editor.md) and [ChatInput](https://editor.lobehub.com/skills/components/react/chat-input.md)      |

Copy this prompt to your agent:

```text
Read https://editor.lobehub.com/skills.md and follow it to add @lobehub/editor.
```

Works with **Cursor**, **Claude Code**, **Windsurf**, **GitHub Copilot** and any tool that can read `llms.txt` or fetch a URL.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 👥 Who is this for?

- **AI chat apps** that need a rich input box with mentions, commands and attachments
- **AI writing and knowledge tools** where a model edits documents and users review the changes
- **Backends** that convert or render editor content without a browser
- **Collaborative editors** that sync documents in real time

## 📦 Entry Points

| Entry                      | Use it for                                                 |
| -------------------------- | ---------------------------------------------------------- |
| `@lobehub/editor`          | Plugins, commands and the editor kernel                    |
| `@lobehub/editor/react`    | `Editor`, `ChatInput`, `SendButton` and hooks              |
| `@lobehub/editor/headless` | Reading and writing documents on the server, without a DOM |
| `@lobehub/editor/renderer` | Read-only, SSR-safe rendering and diffs of saved content   |

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📚 Documentation

Full guides, API tables and live demos are at **[editor.lobehub.com](https://editor.lobehub.com)**:

- [Editor](https://editor.lobehub.com/components/react/editor) and [ChatInput](https://editor.lobehub.com/components/react/chat-input)
- [Plugins](https://editor.lobehub.com/components/plugins/common) — Markdown, slash, mention, table, code, math and more
- [LexicalRenderer](https://editor.lobehub.com/components/renderer/lexical-renderer) and [LexicalDiff](https://editor.lobehub.com/components/renderer/lexical-diff)
- [Changelog](https://editor.lobehub.com/changelog)

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🛠️ Local Development

You can use Github Codespaces for online development:

[![][github-codespace-shield]][github-codespace-link]

Or clone it for local development:

```bash
$ git clone https://github.com/lobehub/lobe-editor.git
$ cd lobe-editor
$ pnpm install
$ pnpm dev
```

`pnpm dev` starts the docs site with live demos. Run `pnpm test` for tests and `pnpm ci` for lint and type checks.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🤝 Contributing

Contributions of all types are more than welcome, if you are interested in contributing code, feel free to check out our GitHub [Issues][github-issues-link] to get stuck in to show us what you're made of.

If you work on the docs site with an AI agent, the repo ships agent skills in [`.agents/skills`](./.agents/skills) (`using-docs-kit`, `building-landing-home`).

[![][pr-welcome-shield]][pr-welcome-link]

[![][github-contrib-shield]][github-contrib-link]

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔗 Links

- **[🤯 Lobe UI](https://github.com/lobehub/lobe-ui)** - React UI component library for AI apps
- **[🌈 Lobe Icons](https://github.com/lobehub/lobe-icons)** - AI & LLM brand logos and icons
- **[📊 Lobe Charts](https://github.com/lobehub/lobe-charts)** - React chart components
- **[✒️ Lobe Editor](https://github.com/lobehub/lobe-editor)** - Lexical-based rich text editor for React, with Markdown, plugins and a chat composer
- **[🗣️ Lobe TTS](https://github.com/lobehub/lobe-tts)** - TTS & STT speech library
- **[📐 Lobe Lint](https://github.com/lobehub/lobe-lint)** - ESLint, Prettier, Stylelint, Commitlint and more lint configs
- **[😊 Fluent Emoji](https://github.com/lobehub/fluent-emoji)** - Fluent Emoji assets

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
[github-stars-link]: https://github.com/lobehub/lobe-editor/stargazers
[github-stars-shield]: https://img.shields.io/github/stars/lobehub/lobe-editor?color=ffcb47&labelColor=black&style=flat-square
[npm-release-link]: https://www.npmjs.com/package/@lobehub/editor
[npm-release-shield]: https://img.shields.io/npm/v/@lobehub/editor?color=369eff&labelColor=black&logo=npm&logoColor=white&style=flat-square
[pr-welcome-link]: https://github.com/lobehub/lobe-editor/pulls
[pr-welcome-shield]: https://img.shields.io/badge/%F0%9F%A4%AF%20PR%20WELCOME-%E2%86%92-ffcb47?labelColor=black&style=for-the-badge
[profile-link]: https://github.com/lobehub
