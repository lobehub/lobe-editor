# 数据流

> **tags**: \[architecture, data-flow, lexical, state, serialization]
> **related_modules**: \[src/editor-kernel, src/react, src/renderer, src/headless, src/plugins]

## 核心数据模型

本项目基于 Lexical 的数据模型，核心类型为 `SerializedEditorState`（Lexical 原生 JSON 格式）。

```ts
// 简化的 Lexical 状态结构
interface SerializedEditorState {
  root: {
    type: 'root';
    children: SerializedLexicalNode[];
  };
}

interface SerializedLexicalNode {
  type: string; // 节点类型，如 "paragraph", "mention", "code"
  version: number;
  [key: string]: any; // 各节点自定义属性
}
```

## 完整数据流图谱

### 1. 编辑态数据流（用户输入 → 状态更新）

```
用户输入（键盘/粘贴/拖拽）
    │
    ▼
DOM 事件（contentEditable）
    │
    ▼
LexicalEditor（原生）── 更新 EditorState（不可变）
    │
    ▼
Kernel.registerUpdateListener ── 触发 update 事件
    │
    ├──────────────┬──────────────┐
    ▼              ▼              ▼
React Hooks    Plugin Logic    onChange Callback
(useEditorState) (Command)     (用户传入)
    │              │              │
    ▼              ▼              ▼
UI 更新        副作用处理      外部状态同步
（Toolbar、     （Markdown       （父组件保存
 FloatMenu）     自动转换等）     SerializedEditorState）
```

### 2. 初始化数据流（外部数据 → 编辑器内容）

```
外部数据（Markdown / JSON / Text）
    │
    ▼
IEditor.setDocument(type, data)
    │
    ▼
Kernel 查找匹配的 DataSource
    │
    ├─────────────────┬─────────────────┐
    ▼                 ▼                 ▼
MarkdownDataSource  JSONDataSource    TextDataSource
(src/plugins/       (src/plugins/     (src/plugins/
 markdown/)          common/)           common/)
    │                 │                 │
    ▼                 ▼                 ▼
解析为 Lexical      parseEditorState  创建 TextNode
EditorState         (原生)            树
    │                 │                 │
    └─────────────────┴─────────────────┘
                      │
                      ▼
            LexicalEditor.setEditorState()
                      │
                      ▼
            React 组件重新渲染（通过 update listener）
```

### 3. 导出数据流（编辑器内容 → 外部数据）

```
LexicalEditor.getEditorState()
    │
    ▼
Kernel.getDocument(type)
    │
    ▼
DataSource.write(editor)
    │
    ├─────────────────┬─────────────────┐
    ▼                 ▼                 ▼
MarkdownDataSource  JSONDataSource    TextDataSource
    │                 │                 │
    ▼                 ▼                 ▼
遍历节点树生成      原生序列化        提取纯文本
Markdown 字符串    JSON 对象
    │                 │                 │
    └─────────────────┴─────────────────┘
                      │
                      ▼
            返回给调用方（保存/发送/导出）
```

### 4. 只读渲染数据流（JSON → React DOM）

```
SerializedEditorState (JSON)
    │
    ▼
LexicalRenderer (props.value)
    │
    ▼
createHeadlessEditor({ nodes: rendererNodes })
    │
    ▼
editor.parseEditorState(value)  ← 反序列化为 Lexical 节点树
    │
    ▼
$getRoot().getChildren()  ← 获取顶层节点数组
    │
    ▼
renderNode() 递归遍历
    │
    ├────────────────────────────────────────┐
    ▼                                        ▼
内置节点 (TextNode, ParagraphNode)      自定义节点 (Image, Code, Math)
    │                                        │
    ▼                                        ▼
renderBuiltinNode()                      node.renderHeadless() 或
(标准 HTML 标签映射)                      RendererRegistry 查找
    │                                        │
    └────────────────────────────────────────┘
                      │
                      ▼
            React Elements 树（静态，不可编辑）
```

### 5. Diff 数据流（两版文档对比）

```
oldValue (SerializedEditorState)
newValue (SerializedEditorState)
    │           │
    └─────┬─────┘
          ▼
computeLexicalDiffRows(old, new)
    │
    ├─ 根级节点 LCS 对齐 ──▶ 标记 equal/insert/delete/modify
    │
    └─ modify 行递归字符级 diff ──▶ 生成带 delete/insert 标记的 TextNode
          │
          ▼
    每行包装为 SerializedEditorState
          │
          ▼
    LexicalRenderer 渲染为双栏（Old / New）
```

## 关键接口与调用链

### 内容设置：`setDocument`

```
IEditor.setDocument(type, data, options?)
  → Kernel.setDocument(type, data, options?)
    → 查找已注册的 DataSource（match type）
      → DataSource.read(lexicalEditor, data, options)
        → lexicalEditor.setEditorState(parsedState)
```

**重要文件**：`src/editor-kernel/kernel.ts`（Kernel.setDocument）、`src/editor-kernel/data-source.ts`

### 内容获取：`getDocument`

```
IEditor.getDocument(type, options?)
  → Kernel.getDocument(type, options?)
    → DataSource.write(lexicalEditor, options)
      → 返回序列化后的数据
```

### 状态监听：`registerUpdateListener`

```
Kernel 内部:
  lexicalEditor.registerUpdateListener(({ editorState, prevEditorState, tags }) => {
    // 触发 Kernel 的 documentChange 事件
    // React Hooks（useEditorState）在此订阅
  })
```

### React 状态同步：`useEditorState`

```
useEditorState()
  → useSyncExternalStore 或 useEffect + registerCommand
    → 监听 SELECTION_CHANGE_COMMAND / CAN_UNDO_COMMAND / CAN_REDO_COMMAND
      → 调用 lexicalEditor.getEditorState().read(() => { ... })
        → 读取当前格式状态（bold/italic/underline 等）
          → setState → React 重新渲染 Toolbar
```

## 数据源类型对照表

| type 参数    | DataSource 实现      | 读（read）                  | 写（write）             | 所在插件                |
| ------------ | -------------------- | --------------------------- | ----------------------- | ----------------------- |
| `'markdown'` | `MarkdownDataSource` | Markdown → Lexical JSON     | Lexical JSON → Markdown | `src/plugins/markdown/` |
| `'json'`     | `JSONDataSource`     | 原生 parseEditorState       | 原生 toJSON             | `src/plugins/common/`   |
| `'text'`     | `TextDataSource`     | 纯文本 → Paragraph+TextNode | 提取所有文本内容        | `src/plugins/common/`   |

## 特殊数据流：Markdown 实时转换

这是本项目最复杂的数据流之一：

```
用户输入文本（如 "# 标题" 或 "**粗体**"）
    │
    ▼
Lexical 触发 KEY_ENTER_COMMAND / TEXT_INSERTION 事件
    │
    ▼
MarkdownPlugin 注册的 Command Listener
    │
    ▼
MarkdownShortCutService 匹配 Transformer
    │
    ├─ elementTransformers: "# " → HeadingNode
    ├─ textFormatTransformers: "**text**" → Bold TextNode
    └─ textMatchTransformers: 自动链接等
    │
    ▼
LexicalEditor.update(() => { $convertToMarkdownNodes() })
    │
    ▼
DOM 更新 + React 重新渲染
```

**重要文件**：`src/plugins/markdown/plugin/index.ts`、`src/plugins/markdown/service/shortcut.ts`

## 特殊数据流：粘贴自动检测

```
用户粘贴内容
    │
    ▼
PASTE_COMMAND 触发
    │
    ▼
MarkdownPlugin 的 paste handler
    │
    ├─ 检测代码语言（避免误将代码识别为 Markdown）
    │
    ├─ 评分系统判断粘贴内容是否为 Markdown
    │
    └─ 若评分达标 → 调用 Markdown 解析器转换
    │
    ▼
若未命中 Markdown 处理 → CommonPlugin 的 paste 处理链接管
    │
    ├─ pasteAsPlainText 配置
    └─ pasteVSCodeAsCodeBlock 配置
```

**重要文件**：`src/plugins/markdown/plugin/index.ts`、`src/plugins/common/plugin/index.ts`
