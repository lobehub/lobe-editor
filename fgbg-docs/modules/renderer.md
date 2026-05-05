# Renderer

> **tags**: \[renderer, headless-render, LexicalRenderer, LexicalDiff, SSR, static]
> **related_modules**: \[src/renderer, src/renderer/engine, src/renderer/renderers, src/renderer/diff]

## 定位

`src/renderer/` 是**只读渲染层（Headless Render）**，将 Lexical 的序列化状态（`SerializedEditorState`）渲染为**静态 React DOM**，无需真实的 `contentEditable`。同时提供 `LexicalDiff` 能力，用于对比两篇文档的差异。

## 核心文件

| 文件                                          | 类型 | 核心内容                           |
| --------------------------------------------- | ---- | ---------------------------------- |
| `src/renderer/LexicalRenderer.tsx`            | 组件 | 主渲染器，接收 JSON 输出 React DOM |
| `src/renderer/LexicalDiff.tsx`                | 组件 | 差异对比渲染器，双栏展示           |
| `src/renderer/engine/render-tree.ts`          | 引擎 | 渲染调度中心，递归遍历节点树       |
| `src/renderer/engine/render-builtin-node.tsx` | 引擎 | 内置标准节点渲染                   |
| `src/renderer/engine/render-text-node.tsx`    | 引擎 | 文本节点格式解析                   |
| `src/renderer/renderers/index.ts`             | 注册 | `RendererRegistry` 管理            |
| `src/renderer/nodes/index.ts`                 | 配置 | Headless Editor 节点注册表         |
| `src/renderer/diff/compute.ts`                | 算法 | LCS 差异计算核心                   |

## LexicalRenderer

### 职责

将 `SerializedEditorState` 渲染为不可编辑的 React 元素树。内部创建独立的 Headless Editor 实例解析状态，与编辑态完全隔离。

### Props

| Prop         | 类型                           | 说明                  |
| ------------ | ------------------------------ | --------------------- |
| `value`      | `SerializedEditorState`        | 要渲染的 Lexical JSON |
| `overrides`  | `Record<string, NodeRenderer>` | 覆盖特定节点的渲染    |
| `extraNodes` | `LexicalNodeConstructor[]`     | 额外注册的节点类型    |
| `variant`    | `'default' \| 'chat'`          | 样式变体              |

### 渲染流程

```
LexicalRenderer (props.value)
    │
    ▼
createHeadlessEditor({ nodes: rendererNodes })
    │
    ▼
editor.parseEditorState(value)
    │
    ▼
$getRoot().getChildren()
    │
    ▼
renderNode() 递归遍历
    │
    ├─ TextNode → renderTextNode() → 解析 format 位掩码为嵌套标签
    ├─ ElementNode → 渲染容器 + 递归子节点
    └─ 自定义节点 → overrides / renderHeadless() / RendererRegistry
    │
    ▼
React Elements 树
```

### 节点渲染优先级

对于每个节点，`renderNode()` 按以下顺序查找渲染器：

1. **`overrides` prop** — 用户传入的覆盖渲染器
2. **`node.renderHeadless()`** — 节点自身实现的 `HeadlessRenderableNode` 接口
3. **`RendererRegistry`** — 全局注册的渲染器映射表
4. **`renderBuiltinNode()`** — 内置标准节点渲染（兜底）

### 内置节点渲染映射

| Lexical 节点类型 | 渲染结果                                       | 文件                             |
| ---------------- | ---------------------------------------------- | -------------------------------- |
| `paragraph`      | `<p>`                                          | `engine/render-builtin-node.tsx` |
| `heading`        | `<h1>` \~ `<h6>`，带 slug id                   | `engine/render-builtin-node.tsx` |
| `list`           | `<ul>` / `<ol>`                                | `engine/render-builtin-node.tsx` |
| `listitem`       | `<li>`                                         | `engine/render-builtin-node.tsx` |
| `link`           | `<a>`（带 sanitizeUrl）                        | `engine/render-builtin-node.tsx` |
| `linebreak`      | `<br />`                                       | `engine/render-builtin-node.tsx` |
| `text`           | 嵌套 `<strong>` `<em>` `<s>` `<u>` `<code>` 等 | `engine/render-text-node.tsx`    |
| `table`          | `<table>` 结构                                 | `engine/render-builtin-node.tsx` |

### 自定义节点渲染器

| 节点类型                | 渲染内容                    | 文件                           |
| ----------------------- | --------------------------- | ------------------------------ |
| `code`                  | `Highlighter` 组件（shiki） | `renderers/codeblock.tsx`      |
| `image` / `block-image` | `<img>`                     | `renderers/image.tsx`          |
| `math` / `mathBlock`    | KaTeX 静态公式              | `renderers/math.tsx`           |
| `mermaid`               | Mermaid 图表预览            | `renderers/mermaid.tsx`        |
| `mention`               | `@label`                    | `renderers/mention.tsx`        |
| `file`                  | 下载链接 / 状态 UI          | `renderers/file.tsx`           |
| `horizontalrule`        | `<hr />`                    | `renderers/horizontalrule.tsx` |

## LexicalDiff

### 职责

对比两个 `SerializedEditorState`，生成行级差异视图，双栏展示 Old / New。

### Props

| Prop         | 类型                        | 说明         |
| ------------ | --------------------------- | ------------ |
| `oldValue`   | `SerializedEditorState`     | 旧版本       |
| `newValue`   | `SerializedEditorState`     | 新版本       |
| `appearance` | `'default' \| 'borderless'` | 差异视图样式 |

### 差异算法

```
computeLexicalDiffRows(oldState, newState)
    │
    ├─ 根级子节点 LCS（最长公共子序列）对齐
    │   → 标记每行：equal / insert / delete / modify
    │
    └─ modify 行递归字符级 diff
        → DP + LCS 细粒度对比
        → 生成带 delete/insert 样式标记的 TextNode
    │
    ▼
每行包装为 SerializedEditorState
    │
    ▼
LexicalRenderer 渲染为双栏
```

**关键文件**：`src/renderer/diff/compute.ts`

### 差异样式

- `delete`：红色背景 / 删除线
- `insert`：绿色背景 / 下划线
- `modify`：黄色高亮，内部再分 delete/insert

样式定义在 `src/renderer/diff/style.ts`。

## RendererRegistry

```ts
// 创建默认渲染器注册表
const registry = createDefaultRenderers();

// 注册自定义渲染器
registry.set('my-custom-node', (node, context) => <div>...</div>);

// 查询渲染器
const renderer = registry.get(nodeType);
```

**扩展只读渲染**：如果要支持新的自定义节点在只读态显示，可以：

1. 让节点类实现 `HeadlessRenderableNode` 接口（`renderHeadless` 方法）
2. 或注册到 `RendererRegistry`
3. 或通过 `LexicalRenderer` 的 `overrides` prop 覆盖

## 样式一致性

`renderer/style.ts` 直接复用各插件 `react/style.ts` 中定义的静态样式类名，确保编辑态和只读态视觉一致。

```ts
// 组合所有插件样式
const className = getRendererClassName();

// 根据 variant 生成 CSS 变量
const cssVars = getCSSVariables(variant); // default 或 chat
```

## 节点注册表

`src/renderer/nodes/index.ts` 导出 `rendererNodes` 数组，包含所有需要在 Headless Editor 中注册的 Lexical Node 类。这是 `LexicalRenderer` 创建 headless editor 时的 `nodes` 配置来源。

```ts
export const rendererNodes = [
  HeadingNode,
  ImageNode,
  CodeMirrorNode,
  MathBlockNode,
  MentionNode,
  FileNode,
  // ... 所有自定义节点
];
```

**注意**：此列表必须与 `editor-kernel` 注册的节点类保持同步，否则解析会失败。

## 与编辑态的关系

```
编辑态 (src/react/Editor)              只读态 (src/renderer/LexicalRenderer)
    │                                          │
    ├─ 共享节点定义（来自 src/plugins/*/node）  ┤
    ├─ 共享主题样式（来自 src/plugins/*/style） ┤
    │                                          │
    ▼                                          ▼
LexicalEditor（有 DOM，可编辑）      Headless Editor（无 DOM，静态）
    │                                          │
    ▼                                          ▼
SerializedEditorState (JSON) ───────▶  parseEditorState()
                                              │
                                              ▼
                                        React DOM（只读）
```

## 使用场景

| 场景              | 使用组件                                                     |
| ----------------- | ------------------------------------------------------------ |
| 消息气泡展示      | `<LexicalRenderer value={message.content} variant="chat" />` |
| 文档预览          | `<LexicalRenderer value={doc} />`                            |
| 历史版本对比      | `<LexicalDiff oldValue={v1} newValue={v2} />`                |
| 服务端渲染（SSR） | 在 Node 环境使用 `HeadlessEditor` 预处理 + `LexicalRenderer` |
| 导出静态 HTML     | `ReactDOMServer.renderToString(<LexicalRenderer ... />)`     |
