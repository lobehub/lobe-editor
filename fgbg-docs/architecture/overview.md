# 架构总览

> **tags**: \[architecture, overview, modules, lexical]
> **related_modules**: \[src/editor-kernel, src/react, src/renderer, src/headless, src/plugins]

## 四层架构

本项目采用**四层架构**，从上到下依次是：

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: React 组件层 (src/react/)                          │
│  - Editor, ChatInput, Toolbar, SlashMenu, Mention...         │
│  - 面向终端开发者的直接使用接口                               │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Editor Kernel (src/editor-kernel/)                 │
│  - Kernel 类: 封装 LexicalEditor，提供 IEditor/IEditorKernel │
│  - KernelPlugin 基类: 插件生命周期管理                        │
│  - DataSource: 多格式数据读写抽象                             │
│  - React 集成: Context, Hooks, Portal, Decorator            │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Lexical 原生层 (node_modules/lexical)              │
│  - LexicalEditor, EditorState, Node, Command 系统            │
│  - 本项目不修改 Lexical 源码，通过 patch 做微调               │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: 基础设施 (src/plugins/, src/utils/, src/types/)    │
│  - 20+ 插件实现具体编辑能力                                   │
│  - 工具函数: 热键、日志、定位、className                       │
│  - 全局类型定义                                               │
└─────────────────────────────────────────────────────────────┘
```

## 核心模块关系图

```
                    终端用户/开发者
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌────────────┐
    │ ChatInput│   │  Editor  │   │LexicalDiff │
    │(UI 容器) │   │(编辑核心)│   │(差异对比)  │
    └────┬─────┘   └────┬─────┘   └─────┬──────┘
         │              │               │
         └──────────────┼───────────────┘
                        ▼
              ┌─────────────────┐
              │    IEditor      │  ← 统一抽象接口
              │  (Kernel 封装)  │
              └────────┬────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   ┌──────────┐ ┌──────────┐ ┌──────────────┐
   │ Plugins  │ │DataSource│ │ LexicalEditor│
   │(能力扩展)│ │(数据转换)│ │(底层状态机)  │
   └────┬─────┘ └────┬─────┘ └──────┬───────┘
        │            │              │
        └────────────┴──────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
        ┌──────────┐     ┌────────────┐
        │ Headless │     │ LexicalRenderer│
        │ Editor   │     │ (只读渲染)   │
        │(SSR/Node)│     └────────────┘
        └──────────┘
```

## 模块职责矩阵

| 模块                | 职责                                                                              | 关键抽象                                          | 不做什么                      |
| ------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------- |
| `src/editor-kernel` | 编辑器内核，管理 Lexical 实例生命周期，提供插件注册、服务注入、数据源、主题国际化 | `Kernel`, `KernelPlugin`, `DataSource`, `IEditor` | 不渲染 UI，不处理具体编辑语法 |
| `src/react`         | 面向消费者的 React 组件和 Hooks，组装编辑器 UI                                    | `Editor`, `ChatInput`, `useEditorState`           | 不直接操作 Lexical 底层 API   |
| `src/renderer`      | 将 Lexical JSON 渲染为静态 React DOM，提供 Diff 能力                              | `LexicalRenderer`, `LexicalDiff`                  | 不可编辑，无状态管理          |
| `src/headless`      | 无 DOM 环境下的编辑器封装，用于 SSR / 数据转换                                    | `HeadlessEditor`                                  | 无 React/DOM 相关能力         |
| `src/plugins/*`     | 具体编辑能力实现（Markdown、表格、代码块等）                                      | 各 Plugin 类 + Node 类 + React 层                 | 不管理编辑器生命周期          |
| `src/types`         | 全局 TypeScript 类型定义                                                          | `IEditor`, `IEditorKernel`, `IEditorPlugin`       | 无运行时逻辑                  |
| `src/utils`         | 通用工具函数                                                                      | `registerHotkey`, `debugLogger`, `cx`             | 无业务逻辑                    |

## 关键设计决策

### 1. Kernel 对 Lexical 的封装方式

- **不是替代**：Kernel 内部持有一个真实的 `LexicalEditor` 实例
- **双向注入**：创建 LexicalEditor 时通过 `__kernel: this` 注入 Kernel 自身，Lexical 节点 / 插件可通过 `getKernelFromEditor(editor)` 反向获取 Kernel
- **目的**：统一插件注册接口、提供服务注入（DI）、管理热重载、屏蔽 Lexical API 差异

### 2. Dual Architecture

- **Kernel API**：可直接操作编辑器（用于非 React 场景、自动化测试、服务端）
- **React Components**：`Editor`, `ChatInput` 等组件封装了 Kernel 的创建和配置过程
- 两者共享同一套 `IEditor` 接口，确保能力一致

### 3. 插件分层模式

每个插件通常分为三层：

```
插件目录 (src/plugins/<name>/)
├── plugin/          # 内核逻辑：注册 Node、Command、Listener、Service
├── node/            # 自定义 Lexical Node 类（数据模型）
├── command/         # Lexical Command 定义
├── service/         # 跨插件共享的服务接口与实现
├── react/           # React UI 层：Decorator、浮动菜单、工具栏
└── utils/           # 插件私有工具函数
```

### 4. Headless 与浏览器端共用代码

- 同一套插件代码同时支持浏览器端和 Headless 端
- 通过 `editor._headless === true` 判断环境，跳过 DOM 相关逻辑（如 `registerTablePlugin`, Shiki 高亮注册）
- `src/headless/` 是精简封装，预置了无 DOM 插件列表

## 扩展点

如果你是 AI，要帮用户扩展本项目，以下是官方扩展点：

| 扩展需求                 | 扩展点                                                    | 示例                                               |
| ------------------------ | --------------------------------------------------------- | -------------------------------------------------- |
| 新增编辑能力             | 继承 `KernelPlugin` 写新插件                              | `src/plugins/slash/plugin/index.ts`                |
| 新增自定义节点           | 继承 Lexical `DecoratorNode` / `ElementNode`              | `src/plugins/mention/node/MentionNode.ts`          |
| 新增 Markdown 语法支持   | 注册 `IMarkdownShortCutService` 的 reader/writer          | `src/plugins/table/plugin/index.ts`                |
| 自定义节点渲染（编辑态） | `kernel.registerDecorator()`                              | `src/plugins/mention/react/ReactMentionPlugin.tsx` |
| 自定义节点渲染（只读态） | 实现 `HeadlessRenderableNode` 或注册 `RendererRegistry`   | `src/renderer/renderers/mention.tsx`               |
| 新增数据源格式           | 继承 `DataSource`                                         | `src/plugins/markdown/data-source/`                |
| 新增热键                 | 在 `src/const/hotkey.ts` 注册 + `kernel.registerHotkey()` | `src/const/hotkey.ts`                              |
| 替换 UI 主题             | `EditorProvider` 的 `theme` 配置                          | `src/react/EditorProvider`                         |
