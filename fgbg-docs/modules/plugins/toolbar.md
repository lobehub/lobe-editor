# Toolbar Plugin

> **tags**: \[plugin, toolbar, floating-ui, selection, format]
> **related_modules**: \[src/plugins/toolbar, src/react/hooks/useEditorState]

## 定位

`ToolbarPlugin` 提供**浮动格式工具栏**，当选中文本时，工具栏出现在选区上方，支持加粗、斜体、下划线、删除线、代码、链接等格式操作。

## 核心文件

| 文件                                   | 类型       | 核心内容                  |
| -------------------------------------- | ---------- | ------------------------- |
| `src/plugins/toolbar/react/index.tsx`  | React 组件 | `ReactToolbarPlugin`      |
| `src/plugins/toolbar/command/index.ts` | 命令       | `HIDE_TOOLBAR_COMMAND` 等 |

## 特点

- **纯 UI 插件**：没有自定义 Node，不扩展数据模型
- **依赖选区状态**：通过 `SELECTION_CHANGE_COMMAND` 和鼠标事件触发显示 / 隐藏
- **定位计算**：使用 `@floating-ui/dom` 计算浮动位置
- **与 LinkPlugin 协作**：通过 `ILinkService` 禁用 Link 插件自身的工具栏，避免冲突

## 触发流程

```
用户选中文本
    │
    ▼
SELECTION_CHANGE_COMMAND
    │
    ▼
ReactToolbarPlugin 监听
    │
    ├─ 获取选区 DOMRect
    │   → 计算工具栏位置
    │
    └─ 读取当前格式状态
        → 高亮对应格式按钮
    │
    ▼
显示浮动工具栏
```

## 隐藏逻辑

- 点击工具栏外部
- 按 Esc 键
- 执行 `HIDE_TOOLBAR_COMMAND`
- 选区消失

## 与 useEditorState 的关系

`ReactToolbarPlugin` 内部可以使用 `useEditorState()` 获取格式状态和操作方法，也可以直接通过 `editor.dispatchCommand()` 执行命令。

```ts
const { bold, toggleBold, italic, toggleItalic } = useEditorState();

// Toolbar 按钮
<button active={bold} onClick={toggleBold}>B</button>
```

## 浮动定位

```ts
// 使用 @floating-ui/dom
updatePosition({
  floating: toolbarRef.current,
  reference: selectionRange.getBoundingClientRect(),
  placement: 'top',
});
```
