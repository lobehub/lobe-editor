# Markdown 粘贴确认系统

> **tags**: \[reference, markdown, paste, confirm, dialog, onPasteMarkdown, confirmPasteMarkdown, i18n]
> **purpose**: 完整记录粘贴 Markdown 文本时的检测、拦截、确认弹窗机制 —— 包含回调注入（`onPasteMarkdown`）和内置弹窗（`confirmPasteMarkdown`）两种模式，以及中英文切换支持。

## 关键文件

| 文件                                                  | 职责                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/plugins/markdown/plugin/index.ts`                | MarkdownPlugin：PASTE_COMMAND 拦截、`onPasteMarkdown` 回调调度、`shouldHandlePasteMarkdown` 门控 |
| `src/react/Editor/Editor.tsx`                         | Editor 组件：`confirmPasteMarkdown` prop → 自动创建 promise 回调 → 渲染 PasteMarkdownConfirm     |
| `src/react/Editor/type.ts`                            | `EditorProps`：`confirmPasteMarkdown`、`onPasteMarkdown` 类型定义                                |
| `src/plugins/markdown/react/PasteMarkdownConfirm.tsx` | 内置弹窗组件：createPortal 渲染、中英文、键盘 Escape、自动 focus、暗色主题                       |
| `src/plugins/common/react/ReactPlainText.tsx`         | ReactPlainText：将 `onPasteMarkdown` 透传给 `MarkdownPlugin` 配置                                |
| `src/plugins/common/react/type.ts`                    | `ReactPlainTextProps`：`onPasteMarkdown` 类型                                                    |
| `src/locale/index.ts`                                 | en-US 默认 locale，含 `markdown.paste*` 键                                                       |
| `src/locale/zh-CN.ts`                                 | zh-CN locale，含 `markdown.paste*` 中文翻译                                                      |
| `src/plugins/markdown/react/index.tsx`                | ReactMarkdownPlugin：`markdownParse` 事件 toast 监听                                             |

## 两种使用模式

### 模式 1：调用方注入自定义回调（`onPasteMarkdown`）

```tsx
<Editor
  onPasteMarkdown={(text: string): Promise<boolean> => {
    // 自定义弹窗逻辑，返回 true 转 Markdown，false 保留纯文本
    return myCustomDialog(text);
  }}
/>
```

**适用场景**：调用方有自己的 UI 组件库，想完全控制弹窗样式和行为。

### 模式 2：Lobe 内置弹窗（`confirmPasteMarkdown`）

```tsx
<Editor confirmPasteMarkdown />
```

**适用场景**：快速接入，开箱即用。内置弹窗自动支持中英文切换、暗色主题、键盘操作。

## 完整数据流

```
用户 Ctrl+V / Cmd+V
    │
    ▼
Lexical 原生 paste 事件 → dispatchCommand(PASTE_COMMAND, clipboardEvent)
    │
    ▼
MarkdownPlugin.onInit → PASTE_COMMAND @ CRITICAL priority
    │
    ├─ !(event instanceof ClipboardEvent) → return false
    ├─ !shouldHandlePasteMarkdown()        → return false
    │   └─ enablePasteMarkdown === false   → false
    │   └─ autoFormatMarkdown === false    → false
    ├─ !clipboardData                      → return false
    ├─ !text (no text/plain)               → return false
    │
    ▼
this.config?.onPasteMarkdown 存在？
    │
    ├─ YES ─────────────────────────────────────────┐
    │   event.preventDefault()                       │
    │   event.stopPropagation()                      │
    │   Promise.resolve(onPasteMarkdown(text))       │
    │       │                                        │
    │       ├─ resolve(true)                         │
    │       │   └─ dispatchCommand(                  │
    │       │       INSERT_MARKDOWN_COMMAND,         │
    │       │       { markdown: text }               │
    │       │     )                                  │
    │       │   └─ emit('markdownParse', ...)        │
    │       │                                        │
    │       └─ resolve(false)                        │
    │           └─ editor.update(() => {             │
    │               selection.insertRawText(text)    │
    │             })                                 │
    │   return true (事件已处理)                     │
    │                                                │
    └─ NO ──────────────────────────────────────────┤
        ├─ hasRichHTML? → return false               │
        ├─ bare URL?    → return false               │
        └─ setTimeout → dispatchCommand(             │
            INSERT_MARKDOWN_COMMAND)                  │
          return false (不阻止默认行为)              │
```

## `confirmPasteMarkdown` 内部机制

Editor 组件在 `confirmPasteMarkdown=true` 时自动创建 promise-based 回调：

```tsx
// src/react/Editor/Editor.tsx

const pasteResolveRef = useRef<((v: boolean) => void) | null>(null);
const [pasteDialog, setPasteDialog] = useState({ text: '', visible: false });

// 自动生成的 onPasteMarkdown 回调
const handlePasteMarkdown = useCallback((text: string): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    pasteResolveRef.current = resolve;
    setPasteDialog({ text, visible: true });
  });
}, []);

// 用户点击"转换"
const handlePasteConfirm = useCallback(() => {
  pasteResolveRef.current?.(true);
  pasteResolveRef.current = null;
  setPasteDialog((p) => ({ ...p, visible: false }));
}, []);

// 用户点击"保留纯文本" 或 点击遮罩 或 按 Escape
const handlePasteCancel = useCallback(() => {
  pasteResolveRef.current?.(false);
  pasteResolveRef.current = null;
  setPasteDialog((p) => ({ ...p, visible: false }));
}, []);
```

关键设计：

- **Ref 存 resolve**：Promise 的 resolve 函数存入 `useRef`，避免闭包陷阱
- **State 驱动 UI**：`setPasteDialog({ visible: true })` 触发 React 重渲染，弹窗出现
- **Portal 渲染**：弹窗通过 `createPortal` 渲染到 `document.body`，脱离 contentEditable DOM 树

## PasteMarkdownConfirm 弹窗组件

### 功能特性

| 特性           | 实现                                                              |
| -------------- | ----------------------------------------------------------------- |
| 中英文切换     | `useTranslation()` → `t('markdown.pasteTitle')` 等 4 个 locale 键 |
| 暗色主题       | `createStyles` from `antd-style`，使用 `token.color*` 变量        |
| 键盘 Escape    | `window.addEventListener('keydown', ..., { capture: true })`      |
| 自动 focus     | 打开后 50ms focus "转换" 按钮                                     |
| 点击遮罩关闭   | `<div className={backdrop} onClick={onCancel} />`                 |
| 恢复编辑器焦点 | 关闭后 `editor?.focus()`                                          |
| 文本预览       | 最多显示前 300 字符，超出省略号，`<pre>` 等宽字体                 |

### Locale 键

| Key                         | en-US                                                        | zh-CN                                              |
| --------------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| `markdown.pasteTitle`       | Markdown Format Detected                                     | 检测到 Markdown 格式                               |
| `markdown.pasteDescription` | Pasted content appears to be Markdown. Convert to rich text? | 粘贴的内容似乎是 Markdown 格式，是否转换为富文本？ |
| `markdown.pasteConfirm`     | Convert                                                      | 转换                                               |
| `markdown.pasteCancel`      | Keep Plain Text                                              | 保留纯文本                                         |

### Props

```typescript
interface PasteMarkdownConfirmProps {
  text: string; // 粘贴的原始文本（用于预览）
  visible: boolean; // 是否显示弹窗
  onConfirm: () => void; // 用户点击"转换"
  onCancel: () => void; // 用户点击"保留纯文本" / Escape / 点击遮罩
}
```

## 设计决策

### 为什么 `onPasteMarkdown` 绕过 `hasRichHTML` 检查？

当调用方显式提供 `onPasteMarkdown`（或启用 `confirmPasteMarkdown`），意味着调用方**明确希望拦截粘贴并询问用户**。此时不应因为剪贴板含有 HTML 就跳过 —— 用户应该有权决定是否转换。点击 "保留纯文本" 即可保留原始 Markdown 字符串。

### 为什么 `autoFormatMarkdown` 仍作为门控？

`shouldHandlePasteMarkdown()` 同时检查 `enablePasteMarkdown` 和 `autoFormatMarkdown`。即使设置了 `confirmPasteMarkdown`，如果 `autoFormatMarkdown=false`，整个 paste handler 仍会跳过。这保证了向后兼容 —— 关闭自动格式化意味着完全禁用粘贴 Markdown 处理。

### 为什么 Portal 到 `document.body` 而非编辑器 root？

`contentEditable` 元素内的非编辑 DOM 节点可能导致：

1. 浏览器将弹窗元素视为可编辑内容
2. 选区异常、光标跳动
3. 事件冒泡被编辑器拦截

Portal 到 `document.body` 完全避开了这些问题。

## 与其他系统的关系

- **MarkdownShortCutService**：粘贴确认系统与快捷转换系统独立。粘贴走 `PASTE_COMMAND` + `INSERT_MARKDOWN_COMMAND`，快捷转换走 `update listener` + `runTransformers`
- **ReactMarkdownPlugin**：监听 `markdownParse` 事件显示 toast（"Markdown Converted"），与确认弹窗互补
- **i18n 系统**：弹窗通过 `useTranslation()` 获取翻译，切换语言后自动更新
