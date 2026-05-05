# React Layer

> **tags**: \[react, components, hooks, Editor, ChatInput, UI]
> **related_modules**: \[src/react, src/react/Editor, src/react/ChatInput, src/react/hooks]

## 定位

`src/react/` 是**面向终端开发者的 React 组件层**，直接提供可复用的富文本编辑 UI。它封装了底层 `editor-kernel` 的复杂初始化逻辑，通过 Props 暴露编辑能力，是外部项目使用本编辑器的最主要入口。

## 核心文件

| 文件                                       | 类型    | 核心导出                             |
| ------------------------------------------ | ------- | ------------------------------------ |
| `src/react/Editor/Editor.tsx`              | 组件    | `Editor`, `EditorProps`              |
| `src/react/ChatInput/ChatInput.tsx`        | 组件    | `ChatInput`, `ChatInputProps`        |
| `src/react/EditorProvider/index.tsx`       | Context | `EditorProvider`, `useEditorContent` |
| `src/react/hooks/useEditor.ts`             | Hook    | `useEditor()`                        |
| `src/react/hooks/useEditorState/index.ts`  | Hook    | `useEditorState()`                   |
| `src/react/hooks/useEditorLocale/index.ts` | Hook    | `useEditorLocale()`                  |
| `src/react/index.ts`                       | 入口    | 聚合导出所有公共 API                 |

## Editor 组件

### 职责

`Editor` 是核心编辑器组件，基于 `ReactEditor`（来自 `editor-kernel/react`）包装。它整合了所有编辑功能，通过 props 暴露配置点。

### 关键 Props

| Prop           | 类型                                     | 说明                         |
| -------------- | ---------------------------------------- | ---------------------------- |
| `plugins`      | `IPlugin[]`                              | 注入的插件列表，覆盖默认插件 |
| `onChange`     | `(value: SerializedEditorState) => void` | 内容变化回调                 |
| `onTextChange` | `(text: string) => void`                 | 纯文本变化回调               |
| `onPressEnter` | `(event) => boolean`                     | 回车键拦截                   |
| `onInit`       | `(editor: IEditor) => void`              | 编辑器初始化完成回调         |
| `defaultValue` | `SerializedEditorState`                  | 初始内容                     |
| `placeholder`  | `ReactNode`                              | 空内容占位符                 |
| `readonly`     | `boolean`                                | 只读模式                     |
| `theme`        | `Record<string, any>`                    | 主题配置                     |

### 内部组装

```tsx
// Editor.tsx 伪代码
<ReactEditor editor={editor} onInit={...}>
  {/* 基础插件 */}
  <ReactCommonPlugin />
  <ReactMarkdownPlugin />

  {/* 用户传入的插件 */}
  {plugins.map(p => <ReactPluginWrapper plugin={p} />)}

  {/* 编辑内容区 */}
  <ReactEditorContent />

  {/* Slash 菜单 */}
  {showSlashMenu && <SlashMenu ... />}

  {/* Mention 自动完成 */}
  {showMention && <MentionAutoComplete ... />}
</ReactEditor>
```

### 与 Kernel 的交互

1. **实例创建**：`useEditor()` → `Editor.createEditor()` → `new Kernel()`
2. **挂载**：`Editor` 将 `IEditor` 传入 `ReactEditor`，创建 `LexicalComposerContext`
3. **内容初始化**：`ReactEditorContent`（来自 `plugins/common`）通过 `editor.setDocument(type, content)` 写入初始内容
4. **命令分发**：`useEditorState` 中的方法通过 `editor.dispatchCommand(...)` 操作
5. **状态监听**：`useEditorState` 注册 `registerUpdateListener` 和 `registerCommand`

## ChatInput 组件

### 职责

`ChatInput` 是**聊天输入框容器**，专为 AI Chat 场景设计。内部通常嵌套 `<Editor />` 使用。

### 特点

- **可拖拽调整高度**：基于 `re-resizable`
- **Header/Footer 插槽**：支持顶部工具栏、底部操作栏
- **全屏模式**：支持展开为全屏编辑
- **主题适配**：自动适配暗黑 / 亮色主题
- **发送按钮集成**：内置 `SendButton`，支持生成中停止状态

### 典型用法

```tsx
<ChatInput
  topActions={...}
  bottomActions={...}
  onSend={handleSend}
  onStop={handleStop}
  generating={isGenerating}
  fullscreen={isFullscreen}
>
  <Editor
    onChange={handleChange}
    placeholder="输入消息..."
  />
</ChatInput>
```

## EditorProvider

全局配置 Context，向下传递 `locale` 和 `theme`。

```tsx
<EditorProvider locale={zhCN} theme={customTheme}>
  <ChatInput>...</ChatInput>
</EditorProvider>
```

子组件通过 `useEditorContent()` 或 `useEditorLocale()` 消费配置。

## Hooks 详解

### useEditor()

```ts
const editor = useEditor({
  plugins: [CustomPlugin],
  locale: zhCN,
});
```

- 内部调用 `Editor.createEditor()`
- 返回 `IEditor` 实例
- 用于需要手动控制编辑器生命周期的场景

### useEditorState()

**最复杂、最常用的 Hook**，聚合了所有编辑器状态。

```ts
const {
  // 格式状态
  bold,
  italic,
  underline,
  strikethrough,
  code,
  subscript,
  superscript,
  // 块类型
  blockType, // 'paragraph' | 'h1' | 'h2' | 'quote' | 'bullet' | 'number' | 'code' | ...
  // 历史状态
  canUndo,
  canRedo,
  // 操作方法
  bold: toggleBold,
  italic: toggleItalic,
  codeblock: insertCodeblock,
  bulletList: toggleBulletList,
  // 颜色
  textColor,
  bgColor,
  setTextColor,
  setBgColor,
} = useEditorState();
```

**内部实现**：

- 使用 `useSyncExternalStore` 或 `useEffect` 订阅 Lexical 更新
- 监听 `SELECTION_CHANGE_COMMAND`, `CAN_UNDO_COMMAND`, `CAN_REDO_COMMAND`
- 在回调中通过 `$getSelection()` 读取当前格式状态
- 格式化方法通过 `editor.dispatchCommand(FORMAT_TEXT_COMMAND, ...)` 或 `editor.getLexicalEditor()?.update(...)` 执行

### useEditorLocale()

```ts
const { t, setLocale, locale } = useEditorLocale();
```

- 通过 `useLexicalComposerContext` 获取编辑器实例
- 调用 `editor.t()` 和 `editor.setLocale()`
- 使用 `useSyncExternalStore` 订阅全局 `localeVersion` 变化

### useSize()

```ts
const width = useWidth(ref);
const height = useHeight(ref);
```

- 基于 `ResizeObserver`
- 用于 `ChatInputActions` 的自适应折叠计算

## 其他 UI 组件

| 组件                 | 路径                            | 职责                              |
| -------------------- | ------------------------------- | --------------------------------- |
| `ChatInputActions`   | `src/react/ChatInputActions/`   | 底部 / 顶部操作栏，支持自适应折叠 |
| `FloatActions`       | `src/react/FloatActions/`       | 简化版操作栏，无自适应折叠        |
| `FloatMenu`          | `src/react/FloatMenu/`          | 浮动菜单 Portal 容器              |
| `SlashMenu`          | `src/react/SlashMenu/`          | 斜杠命令菜单                      |
| `SendButton`         | `src/react/SendButton/`         | 发送 / 停止按钮                   |
| `CodeLanguageSelect` | `src/react/CodeLanguageSelect/` | 代码块语言选择器（基于 shiki）    |
| `ColorPickerBtn`     | `src/react/ColorPickerBtn.tsx`  | 颜色选择按钮                      |

## 数据流向

```
用户交互（点击 Toolbar、输入文本）
    │
    ├─ Toolbar 点击 ──▶ useEditorState 方法 ──▶ editor.dispatchCommand()
    ├─ 键盘输入 ──▶ LexicalEditor ──▶ update listener ──▶ useEditorState 刷新
    └─ Slash 选择 ──▶ SlashPlugin ──▶ editor.update(() => { $insertNodes() })
    │
    ▼
LexicalEditorState 更新
    │
    ├─ React 重新渲染（通过 Context/State）
    └─ onChange callback（用户传入）
```

## 扩展点

| 扩展需求             | 方式                                                          |
| -------------------- | ------------------------------------------------------------- |
| 替换 Editor 内部组件 | 通过 `plugins` prop 注入自定义 React 插件                     |
| 自定义 Toolbar       | 使用 `useEditorState()` 获取状态，自行组装 UI                 |
| 自定义主题           | `EditorProvider` 的 `theme` prop 或 `editor.registerThemes()` |
| 监听特定命令         | `editor.registerCommand()` 或自定义插件                       |
| 修改 ChatInput 布局  | `ChatInput` 的 `topActions` / `bottomActions` slots           |
