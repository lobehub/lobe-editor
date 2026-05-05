# Common Plugin

> **tags**: \[plugin, common, base, node, data-source, history, paste]
> **related_modules**: \[src/plugins/common, src/editor-kernel/data-source]

## 定位

`CommonPlugin` 是**基础能力插件**，几乎所有编辑器实例都必须加载。它提供最基础的节点类型、数据源、历史记录、粘贴处理等功能。

## 核心文件

| 文件                                              | 类型   | 核心内容                 |
| ------------------------------------------------- | ------ | ------------------------ |
| `src/plugins/common/plugin/index.ts`              | 插件类 | `CommonPlugin`           |
| `src/plugins/common/node/cursor.ts`               | 节点   | `CursorNode`（光标占位） |
| `src/plugins/common/react/Placeholder/index.tsx`  | 组件   | 空内容占位符             |
| `src/plugins/common/react/ReactEditorContent.tsx` | 组件   | 编辑器内容初始化         |

## 功能清单

| 功能            | 说明                                      |
| --------------- | ----------------------------------------- |
| **基础节点**    | `HeadingNode`, `QuoteNode`, `CursorNode`  |
| **数据源**      | `JSONDataSource`, `TextDataSource`        |
| **历史记录**    | `registerHistory`（undo/redo）            |
| **粘贴处理**    | 粘贴链处理、纯文本粘贴、VSCode 代码块粘贴 |
| **富文本支持**  | `registerRichText`                        |
| **Dragon 支持** | `registerDragonSupport`（语音识别）       |
| **键盘行为**    | `Shift+Enter` 转段落                      |

## DataSource 实现

### JSONDataSource

```ts
class JSONDataSource extends DataSource {
  readonly type = 'json';

  read(editor, data) {
    editor.setEditorState(editor.parseEditorState(data));
  }

  write(editor) {
    return editor.getEditorState().toJSON();
  }
}
```

### TextDataSource

```ts
class TextDataSource extends DataSource {
  readonly type = 'text';

  read(editor, data) {
    // 纯文本转换为 Paragraph + TextNode 树
  }

  write(editor) {
    // 遍历节点树提取所有文本内容
  }
}
```

## 粘贴处理链

```
用户粘贴
    │
    ▼
PASTE_COMMAND
    │
    ├─ MarkdownPlugin 先尝试处理（如果是 Markdown 内容）
    │
    └─ CommonPlugin 兜底处理
       ├─ pasteAsPlainText 配置为 true → 纯文本粘贴
       ├─ 检测到 VSCode 格式 → 转为 Codeblock
       └─ 默认 → 富文本粘贴（保留格式）
```

## 配置选项

```ts
interface CommonPluginConfig {
  enableHistory?: boolean; // 默认 true
  pasteAsPlainText?: boolean; // 默认 false
  pasteVSCodeAsCodeBlock?: boolean; // 默认 true
}
```
