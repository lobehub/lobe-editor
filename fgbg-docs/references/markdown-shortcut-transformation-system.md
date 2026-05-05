# Markdown 快捷转换系统

> **tags**: \[reference, system, markdown, transformer, shortcut, text-match, element, text-format, paste, IME]
> **purpose**: 完整记录 Markdown 语法在编辑器中的实时转换机制 —— 哪种语法由哪个插件处理、何时触发、走什么代码路径。包含 paste 行为、link/image 空文本 / 空 URL 处理、IME 陷阱等边界情况。

## 关键文件

| 文件                                           | 职责                                                                                                                  |     |                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --- | ------------------ |
| `src/plugins/markdown/plugin/index.ts`         | MarkdownPlugin：update listener（实时转换）、KEY_ENTER_COMMAND 拦截（含 text-match）、PASTE_COMMAND 拦截              |     |                    |
| `src/plugins/markdown/service/shortcut.ts`     | MarkdownShortCutService：transformer 注册中心、`testTransformers` / `runTransformers` 调度（text-match 检测）         |     |                    |
| `src/plugins/markdown/service/transformers.ts` | 三种 transformer 类型定义 + `runElementTransformers` / `runTextMatchTransformers` / `$runTextFormatTransformers` 实现 |     |                    |
| `src/plugins/markdown/utils/index.ts`          | `canContainTransformableMarkdown`（排除 code 节点）                                                                   |     |                    |
| `src/plugins/common/plugin/index.ts`           | CommonPlugin：text-format transformers（bold/italic/strikethrough 等）、element transformers（quote/heading）         |     |                    |
| `src/plugins/image/plugin/index.ts`            | ImagePlugin：`registerMarkdown()` 注册 image text-match transformer，正则 `[^)]*` 允许空 URL                          |     |                    |
| `src/plugins/link/plugin/index.ts`             | LinkPlugin：text-match transformer，正则 `[^[]*` 允许空文本，\`linkText                                               |     | linkUrl\` fallback |
| `src/plugins/link-highlight/plugin/index.ts`   | LinkHighlightPlugin：`<url>` text-match（trigger `>`），paste handler 已移除                                          |     |                    |
| `src/plugins/list/plugin/index.ts`             | ListPlugin：element transformers（unordered/ordered/task list）                                                       |     |                    |
| `src/plugins/codeblock/plugin/index.ts`        | CodeblockPlugin：element transformer（code fence）                                                                    |     |                    |
| `src/plugins/link/plugin/index.ts`             | LinkPlugin：text-match transformer（`[text](url)`）                                                                   |     |                    |
| `src/plugins/hr/plugin/index.ts`               | HrPlugin：element transformer（`---` / `***`）                                                                        |     |                    |
| `src/plugins/math/plugin/index.ts`             | MathPlugin：text-match（inline `$...$`）+ element（block `$$`）                                                       |     |                    |

## 三种 Transformer 类型

| 类型            | 触发时机                                                       | 示例                                                       | 注册方                                                          |
| --------------- | -------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| **element**     | 输入空格（默认）或 Enter（`trigger: 'enter'`）                 | `# ` → heading, `- ` → list, `---` + Enter → hr            | CommonPlugin, ListPlugin, CodeblockPlugin, HrPlugin, MathPlugin |
| **text-match**  | 输入 `trigger` 指定字符时，**或按 Enter 时**（Enter 兜底检测） | `![](url)` 输入 `)` → image, `[text](url)` 输入 `)` → link | ImagePlugin, LinkPlugin, MathPlugin(inline)                     |
| **text-format** | 输入 `tag` 末尾字符时                                          | `**text**` → bold, `~~text~~` → strikethrough              | CommonPlugin                                                    |

## 实时转换的两条触发路径

### 路径 1：打字时 update listener（TEXT_INSERTION 后触发）

```
用户键入每个字符
    │
    ▼
Lexical TEXT_INSERTION 事件 → update listener (markdown/plugin/index.ts:162)
    │
    ├─ isComposing()? → return（IME 输入中，跳过转换）
    ├─ selection 不 collapsed？→ return
    ├─ !dirtyLeaves.has(anchorKey)？→ return
    │
    ▼
editor.update(() => {
  canContainTransformableMarkdown(anchorNode)
    │
    ▼
  service.runTransformers(parentNode, anchorNode, offset)
    ├─ runElementTransformers(fromTrigger 非 'enter' → 检查最后一字符是否为空格)
    ├─ runTextMatchTransformers(按 trigger 字符索引匹配)
    └─ $runTextFormatTransformers(按 tag 末尾字符索引匹配)
})
```

**关键陷阱**：`editor.isComposing()` (line 169) 在中文输入法激活时始终为 true，导致 update listener 直接 return。此时即使输入了正确的 markdown 语法（如 `)![](url)` 的最后一个 `)` 是半角），也不会触发转换。**关闭输入法**或用纯英文输入模式可解决。

### 路径 2：Enter 键 KEY_ENTER_COMMAND（IME 兜底）

```
用户按 Enter
    │
    ▼
KEY_ENTER_COMMAND @ CRITICAL priority (markdown/plugin/index.ts:217)
    │
    ▼
service.testTransformers(parentNode, anchorNode, offset, 'enter')
    │
    ├─ testElementTransformers（trigger === 'enter' 的 element transformers）
    ├─ 同时检测 text-match transformers（lastChar 对应的 trigger 和 regExp）
    ├─ 不检测 text-format
    │
    ▼
匹配？→ queueMicrotask → editor.update → service.runTransformers('enter')
未匹配？→ return false（不拦截 Enter，正常插入换行）
```

**Enter 兜底 text-match**：`testTransformers` 在 `trigger === 'enter'` 时会额外遍历 `textMatchTransformersByTrigger[lastChar]` 检测 regExp。这确保 IME composing 挡住 update listener 时，用户回车也能触发 `)` trigger 的 link/image 转换。

## 粘贴 Markdown 转换

### 流程

```
用户粘贴
    │
    ▼
PASTE_COMMAND @ CRITICAL priority (markdown/plugin/index.ts:270)
    │
    ├─ shouldHandlePasteMarkdown()? → 检查 enablePasteMarkdown / autoFormatMarkdown
    ├─ !text? → return
    ├─ hasRichHTML()? → return（保留原生富文本粘贴）
    ├─ 裸 URL 检测: /^https?:\/\/\S+$/i.test(text) → return（避免 remark-gfm autolink）
    │
    ▼
dispatchCommand(INSERT_MARKDOWN_COMMAND, { markdown: text })
    │
    ▼
parseMarkdownToLexical → remark().use(remarkGfm).parse() → mdast 树 → convertMdastToLexical
```

### 裸 URL 跳过

`remark-gfm` 会把裸 URL（如 `http://localhost:8000/`）自动转为 autolink 节点，导致粘贴的纯 URL 变成 link 节点。通过在 paste handler 加 `/^https?:\/\/\S+$/i` 检测，匹配到裸 URL 就 `return false` 跳过。

### 评分系统（已移除）

原先有一整套 paste 检测规则（`MARKDOWN_DETECTION_RULES`，17 条规则，包括 headers/links/images/tables 等，含加分和扣分），达到阈值（默认 5 分）才转 Markdown。**已全部移除**，现在粘贴直接走 Markdown 转换。

### LinkPlugin / LinkHighlightPlugin PASTE_COMMAND（已移除）

两个插件原先都注册了 PASTE_COMMAND handler 拦截粘贴的 URL：

- **LinkPlugin**（`NORMAL` priority）：匹配 URL → `INSERT_LINK_COMMAND` → LinkNode
- **LinkHighlightPlugin**（`NORMAL` priority）：匹配 URL → `LinkHighlightNode`

这些 handler 已移除。现在只有手动输入 `[text](url)`（typing `)` trigger）或 `<url>`（trigger `>`）才会触发 link 创建。

## Link & Image text-match 空文本 / 空 URL 处理

### `[](url)` 行为

| 输入          | 是否转换   | 显示效果                 | 原因                                                                      |
| ------------- | ---------- | ------------------------ | ------------------------------------------------------------------------- |
| `[]()`        | **不转换** | 保持纯文本               | URL 部分 `([^\s()]+)` 要求至少 1 个非空白 / 非括号字符                    |
| `[](http)`    | 转换       | 显示 "http" 作为链接文本 | `linkText \|\| linkUrl` fallback（`src/plugins/link/plugin/index.ts:73`） |
| `[text](url)` | 转换       | 显示 "text"              | 正常行为                                                                  |

### `![]()` 行为

| 输入          | 是否转换 | 显示效果                        | 原因                                                                  |
| ------------- | -------- | ------------------------------- | --------------------------------------------------------------------- |
| `![]()`       | 转换     | 空 src ImageNode/BlockImageNode | regex `([^)]*)` 允许空 URL（`src/plugins/image/plugin/index.ts:166`） |
| `![alt](url)` | 转换     | 正常 ImageNode                  | 正常行为                                                              |

## Transformer 注册一览表

| 语法                  | Transformer 类型 | Trigger     | 注册方          | 说明                                            |
| --------------------- | ---------------- | ----------- | --------------- | ----------------------------------------------- |
| `# ` \~ `###### `     | element          | 空格        | CommonPlugin    | heading                                         |
| `> `                  | element          | 空格        | CommonPlugin    | blockquote                                      |
| `- ` / `* ` / `+ `    | element          | 空格        | ListPlugin      | unordered list                                  |
| `1. `                 | element          | 空格        | ListPlugin      | ordered list                                    |
| `- [ ] ` / `- [x] `   | element          | 空格        | ListPlugin      | task list                                       |
| `\`\`\`lang\`         | element          | Enter       | CodeblockPlugin | code fence                                      |
| `---` / `***` / `___` | element          | Enter       | HrPlugin        | horizontal rule                                 |
| `$$`                  | element          | Enter       | MathPlugin      | math block                                      |
| `**text**`            | text-format      | `*`         | CommonPlugin    | bold                                            |
| `*text*`              | text-format      | `*`         | CommonPlugin    | italic                                          |
| `~~text~~`            | text-format      | `~`         | CommonPlugin    | strikethrough                                   |
| `[text](url)`         | text-match       | `)` / Enter | LinkPlugin      | link，空文本 fallback 显示 URL                  |
| `![alt](url)`         | text-match       | `)` / Enter | ImagePlugin     | image → ImageNode/BlockImageNode，空 URL 也匹配 |
| `$math$`              | text-match       | `$`         | MathPlugin      | inline math                                     |

## 架构设计原则

**谁生产节点，谁注册 transformer**。MarkdownPlugin 只提供 `MarkdownShortCutService`（注册能力），不感知具体节点创建逻辑。各插件在自己的 `registerMarkdown()` 中注册对应的 transformer/reader/writer。
