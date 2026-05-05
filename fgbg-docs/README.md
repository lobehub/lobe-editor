# fgbg-docs: LobeHub Editor AI 知识库

> **面向 AI 的检索地图**。如果你是 AI Agent，第一次访问本项目时应先阅读此文件，了解知识库结构和检索策略。

## 项目速览

- **项目**: `@lobehub/editor` —— 基于 Meta Lexical 框架的富文本编辑器
- **技术栈**: React 19+ / TypeScript / Vite / Dumi
- **架构模式**: Dual Architecture（Kernel API + React Components）
- **核心特点**: 插件化、Headless 渲染、Markdown 原生支持、AI Chat 场景优化

## 知识库目录结构

```
fgbg-docs/
├── README.md                 ← 你在这里
├── architecture/             # 架构设计文档
│   ├── overview.md           # 四层架构总览与模块关系
│   └── data-flow.md          # 编辑态到只读态的完整数据流
├── modules/                  # 核心模块详细说明
│   ├── editor-kernel.md      # 编辑器内核（Kernel、Plugin 基类、DataSource）
│   ├── react-layer.md        # React 组件层（Editor、ChatInput、Hooks）
│   ├── renderer.md           # 只读渲染层（LexicalRenderer、LexicalDiff）
│   ├── headless.md           # Headless 编辑器（SSR/数据转换）
│   ├── plugin-system.md      # 插件系统架构与生命周期
│   └── plugins/              # 各插件详细文档
│       ├── common.md
│       ├── markdown.md
│       ├── slash.md
│       ├── mention.md
│       ├── codeblock.md
│       ├── table.md
│       └── toolbar.md
└── references/               # 速查与索引
    ├── code-index.md         # 核心文件路径 → 功能索引表
    └── paste-image-url-plugin-design.md       # 粘贴图片 URL 链路设计：ImagePlugin 与 LinkHighlightPlugin 的 PASTE_COMMAND 交互、优先级、useSuspenseImage 缓存
```

## AI 检索策略

### 1. 按问题类型定位文档

| 你的问题类型                     | 优先查阅                                      |
| -------------------------------- | --------------------------------------------- |
| "某个功能在哪实现？"             | `references/code-index.md`                    |
| "模块之间如何协作？"             | `architecture/overview.md`                    |
| "数据怎么流转？"                 | `architecture/data-flow.md`                   |
| "插件怎么开发 / 注册？"          | `modules/plugin-system.md`                    |
| "具体插件的逻辑？"               | `modules/plugins/<name>.md`                   |
| "Kernel 提供了哪些 API？"        | `modules/editor-kernel.md`                    |
| "React 组件怎么用 / 扩展？"      | `modules/react-layer.md`                      |
| "服务端渲染 / 静态导出？"        | `modules/renderer.md` + `modules/headless.md` |
| "为什么代码这样写？/ 历史坑点？" | `references/bugs-and-pitfalls.md`             |

### 2. 按文件路径反向检索

如果你拿到了一个文件路径（如 `src/plugins/markdown/service/shortcut.ts`），在 `references/code-index.md` 中可以快速定位该文件属于哪个模块、承担什么职责、关联哪些其他文件。

### 3. 关键词快速导航

- **Kernel** / **IEditor** / **IEditorKernel** → `modules/editor-kernel.md`
- **Plugin** / **生命周期** / **registerNodes/registerService** → `modules/plugin-system.md`
- **LexicalRenderer** / **LexicalDiff** / **headless render** → `modules/renderer.md`
- **ChatInput** / **Editor** / **useEditorState** → `modules/react-layer.md`
- **DataSource** / **setDocument** / **getDocument** → `modules/editor-kernel.md` 的 DataSource 章节
- **Decorator** / **Portal** / **ReactEditor** → `modules/editor-kernel.md` 的 React 集成章节
- **Markdown** / **粘贴转换** / **快捷输入** → `modules/plugins/markdown.md`
- **Slash** / **Mention** / **AutoComplete** → 对应插件文档
- **Shiki** / **Codeblock** / **高亮** → `modules/plugins/codeblock.md`
- **Diff** / **compare** / **LCS** → `modules/renderer.md` 的 diff 章节

## 重要约定

- 所有文档中的文件路径均相对于项目根目录（即 `src/...`）
- 代码片段中的类型和接口定义均来自实际源码
- 文档更新日期标注在文件末尾，若代码已变更请以代码为准

## 扩展建议

当 AI 在代码中遇到新的设计模式、特殊处理或坑点时，应更新以下文件：

1. 如果是某模块特有的 → 更新对应 `modules/*.md`
2. 如果是跨模块的通用坑点 → 更新 `references/bugs-and-pitfalls.md`
3. 如果是新文件 / 新插件 → 更新 `references/code-index.md`
