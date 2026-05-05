# Headless Editor

> **tags**: \[headless, SSR, node, server-side, data-conversion, HeadlessEditor]
> **related_modules**: \[src/headless, src/editor-kernel]

## 定位

`src/headless/` 是**无 UI 编辑器封装层**，专门用于服务端（Node）、静态数据转换、单元测试等无 DOM 环境。它剥离了所有 React/DOM 相关能力，只保留核心编辑和数据处理功能。

## 核心文件

| 文件                                             | 类型 | 核心内容                          |
| ------------------------------------------------ | ---- | --------------------------------- |
| `src/headless/index.ts`                          | 类   | `HeadlessEditor` 类与默认插件列表 |
| `src/headless/plugins/codeblock.ts`              | 插件 | Headless 专用代码块插件           |
| `src/headless/__tests__/headless-editor.test.ts` | 测试 | Headless 功能测试                 |

## HeadlessEditor 类

### 创建方式

```ts
import { HeadlessEditor } from '@/headless';

const editor = new HeadlessEditor();
```

### 与 Kernel 的区别

| 维度           | `editor-kernel` (Kernel)                        | `headless` (HeadlessEditor)    |
| -------------- | ----------------------------------------------- | ------------------------------ |
| **定位**       | 编辑器内核基座                                  | 无 UI 场景的快速封装           |
| **DOM 依赖**   | 可选（支持 setRootElement /initHeadlessEditor） | 完全无 DOM                     |
| **编辑器创建** | `createEditor()` 或 `createHeadlessEditor()`    | 统一走 `initHeadlessEditor()`  |
| **UI 能力**    | 通过 Decorator、Service、Theme 支持             | 剥离所有 React/DOM 能力        |
| **使用方**     | `react` 层、`renderer` 层                       | 服务端渲染、静态导出、单元测试 |
| **插件**       | 完整插件（带 Shiki、Portal 等）                 | 精简插件列表                   |

### 默认插件列表

```ts
const DEFAULT_HEADLESS_EDITOR_PLUGINS = [
  [CommonPlugin, { enableHotkey: false }], // 关闭热键，无 DOM 事件
  MarkdownPlugin, // Markdown 解析与导出
  CodePlugin, // 行内代码
  HeadlessCodeblockPlugin, // 代码块（无 Shiki 高亮、无粘贴）
  HRPlugin, // 分隔线
  ListPlugin, // 列表
  TablePlugin, // 表格
];
```

**注意**：`CommonPlugin` 配置了 `enableHotkey: false`，因为在无 DOM 环境下不需要键盘事件监听。

### 便捷 API

```ts
class HeadlessEditor {
  // Markdown ↔ Lexical JSON 双向转换
  hydrateMarkdown(markdown: string): SerializedEditorState;

  // 通用数据转换
  hydrateEditorData(data: any, type: string): SerializedEditorState;

  // 导出
  export(type: string): any;
}
```

## Headless 条件屏蔽模式

在多个插件中广泛使用 `editor._headless` 判断来跳过 DOM 逻辑：

```ts
function isHeadlessEditor(editor: LexicalEditor): boolean {
  return editor._headless === true;
}

// TablePlugin 示例
onInit(editor: LexicalEditor): void {
  if (!isHeadlessEditor(editor)) {
    // 仅在有 DOM 环境时注册
    this.register(registerTablePlugin(editor));
    this.register(registerTableSelectionObserver(editor));
  }
}

// CodeblockPlugin 示例
onInit(editor: LexicalEditor): void {
  if (!isHeadlessEditor(editor)) {
    // 注册 Shiki 高亮
    this.register(registerShikiHighlighter(editor));
    // 注册粘贴拦截
    this.register(registerPasteHandler(editor));
  }
}
```

**这是插件系统同时支持浏览器端和 Headless 端的关键设计**。

## HeadlessCodeblockPlugin

```ts
// src/headless/plugins/codeblock.ts
class HeadlessCodeblockPlugin extends KernelPlugin {
  // 与 CodeblockPlugin 的区别：
  // 1. 不注册 Shiki 高亮
  // 2. 不拦截粘贴事件
  // 3. 保留 Markdown reader/writer，支持代码块的序列化/反序列化
}
```

## 使用场景

| 场景              | 用法                                                       |
| ----------------- | ---------------------------------------------------------- |
| 服务端渲染（SSR） | `new HeadlessEditor()` → `hydrateMarkdown(md)` → 返回 JSON |
| 导入 Markdown     | `headless.hydrateMarkdown(markdownString)`                 |
| 导出 Markdown     | `headless.export('markdown')`                              |
| 单元测试          | 创建 HeadlessEditor 测试数据转换逻辑                       |
| 静态站点生成      | 构建时预渲染内容为 JSON                                    |

## 与 Renderer 的协作

```
Markdown 文本
    │
    ▼
HeadlessEditor.hydrateMarkdown()
    │
    ▼
SerializedEditorState (JSON)
    │
    ├─ 保存到数据库 ──▶ 后续读取
    └─ 直接渲染 ──▶ LexicalRenderer
```

## 数据转换全链路

```
用户输入 Markdown
    │
    ▼
HeadlessEditor.hydrateMarkdown(md)
    │
    ▼
MarkdownDataSource.read()
    │
    ▼
mdast 解析 → Lexical 节点树
    │
    ▼
SerializedEditorState
    │
    ├─ 存储/传输
    │
    ▼
LexicalRenderer 渲染为 React DOM
    │
    ▼
用户看到渲染结果
```
