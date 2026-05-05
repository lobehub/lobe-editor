# Markdown Plugin

> **tags**: \[plugin, markdown, markdown-shortcut, paste, copy, transformer]
> **related_modules**: \[src/plugins/markdown, src/plugins/markdown/service/shortcut.ts, src/plugins/markdown/data-source]

## 定位

`MarkdownPlugin` 是整个编辑器的 **Markdown 中枢**，负责：

1. 实时快捷转换（输入 `# ` 变标题、`- ` 变列表等）
2. 粘贴自动检测转换（判断粘贴内容是否为 Markdown 并转换）
3. 复制导出 Markdown（重写 `COPY_COMMAND`，将剪贴板设为 Markdown）
4. 数据源读写（`setDocument('markdown', ...)`）

## 核心文件

| 文件                                                 | 类型   | 核心内容                  |
| ---------------------------------------------------- | ------ | ------------------------- |
| `src/plugins/markdown/plugin/index.ts`               | 插件类 | `MarkdownPlugin`          |
| `src/plugins/markdown/service/shortcut.ts`           | 服务   | `MarkdownShortCutService` |
| `src/plugins/markdown/data-source/markdown/parse.ts` | 解析   | mdast → Lexical JSON      |
| `src/plugins/markdown/utils/detectLanguage.ts`       | 工具   | 粘贴时检测代码语言        |

## MarkdownShortCutService

这是 Markdown 插件的核心服务，其他插件通过它注册自己的 Markdown 支持。

```ts
class MarkdownShortCutService {
  // 元素级转换器（块级）
  elementTransformers: ElementTransformer[];

  // 文本格式转换器（行内）
  textFormatTransformers: TextFormatTransformer[];

  // 文本匹配转换器（自动链接等）
  textMatchTransformers: TextMatchTransformer[];

  // Markdown 读写器（供 DataSource 使用）
  markdownWriters: MarkdownWriter[];
  markdownReaders: MarkdownReader[];
}
```

### 元素转换器示例

````ts
// Heading 转换
{ trigger: '# ', type: 'heading', tag: 'h1' }

// List 转换
{ trigger: '- ', type: 'bullet' }
{ trigger: '1. ', type: 'number' }

// Codeblock 转换
{ trigger: '```', type: 'code' }
````

### 文本格式转换器示例

```ts
// Bold: **text**
{ trigger: '**', format: 'bold' }

// Italic: *text*
{ trigger: '*', format: 'italic' }

// Strikethrough: ~~text~~
{ trigger: '~~', format: 'strikethrough' }
```

## 实时快捷转换流程

```
用户输入 "# " 后按空格/回车
    │
    ▼
KEY_ENTER_COMMAND / TEXT_INSERTION 事件
    │
    ▼
MarkdownPlugin 的 Command Listener
    │
    ▼
MarkdownShortCutService.matchElementTransformer(trigger)
    │
    ▼
匹配到 Heading Transformer
    │
    ▼
LexicalEditor.update(() => {
  // 将当前段落转为 HeadingNode
  $wrapNodesInHeading();
})
```

## 粘贴自动检测流程

```
用户粘贴内容
    │
    ▼
PASTE_COMMAND
    │
    ▼
MarkdownPlugin paste handler
    │
    ├─ 调用 detectLanguage() 检测是否为代码
    │   → 若是代码 → 跳过 Markdown 处理
    │
    ├─ 评分系统判断粘贴内容是否为 Markdown
    │   → 基于正则、结构特征打分
    │
    └─ 若评分达标 → 调用 MarkdownDataSource.read()
       → mdast 解析 → Lexical 节点树
    │
    ▼
若未命中 → 交由 CommonPlugin 处理
```

## 复制导出流程

```
用户按 Ctrl+C 或调用复制
    │
    ▼
COPY_COMMAND
    │
    ▼
MarkdownPlugin 重写 copy handler
    │
    ▼
MarkdownDataSource.write(editor)
    │
    ▼
遍历节点树生成 Markdown 字符串
    │
    ▼
设置 clipboardData:
  text/plain: Markdown 字符串
  text/html: HTML 字符串（保留格式）
```

## 数据源

```ts
// 读取
editor.setDocument('markdown', '# Hello\n\nWorld');
// → MarkdownDataSource.read() → mdast 解析 → Lexical EditorState

// 写入
const md = editor.getDocument('markdown');
// → MarkdownDataSource.write() → Markdown 字符串
```

## 关键 mdast 解析路径

```
Markdown 字符串
    │
    ▼
mdast 解析（remark-parse）
    │
    ▼
mdast 树（paragraph, heading, list, code, etc.）
    │
    ▼
自定义 visitor 遍历
    │
    ▼
Lexical 序列化节点树（SerializedEditorState）
```

**重要文件**：`src/plugins/markdown/data-source/markdown/parse.ts`

## 与其他插件的关系

- **所有插件**都可以注册自己的 `MarkdownReader` / `MarkdownWriter` 到 `MarkdownShortCutService`
- **TablePlugin**：注册表格的 Markdown 读写（GFM 格式）
- **CodeblockPlugin**：注册代码块的 Markdown 读写（\`\`\`）
- **MentionPlugin**：注册提及的 Markdown 读写（`@label`）
