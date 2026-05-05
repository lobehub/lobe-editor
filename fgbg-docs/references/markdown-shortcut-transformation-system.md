# Markdown 快捷转换系统

> **tags**: \[reference, system, markdown, transformer, shortcut, text-match, element, text-format, paste, IME]
> **purpose**: 完整记录 Markdown 语法在编辑器中的实时转换机制 —— 哪种语法由哪个插件处理、何时触发、走什么代码路径。

## 关键文件

| 文件                                           | 职责                                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/plugins/markdown/plugin/index.ts`         | MarkdownPlugin：update listener（实时转换）、KEY_ENTER_COMMAND 拦截、PASTE_COMMAND 拦截                               |
| `src/plugins/markdown/service/shortcut.ts`     | MarkdownShortCutService：transformer 注册中心、`runTransformers` / `testTransformers` 调度                            |
| `src/plugins/markdown/service/transformers.ts` | 三种 transformer 类型定义 + `runElementTransformers` / `runTextMatchTransformers` / `$runTextFormatTransformers` 实现 |
| `src/plugins/markdown/utils/index.ts`          | `canContainTransformableMarkdown`（排除 code 节点）                                                                   |
| `src/plugins/common/plugin/index.ts`           | CommonPlugin：text-format transformers（bold/italic/strikethrough 等）、element transformers（quote/heading）         |
| `src/plugins/image/plugin/index.ts`            | ImagePlugin：`registerMarkdown()` 注册 image text-match transformer                                                   |
| `src/plugins/list/plugin/index.ts`             | ListPlugin：element transformers（unordered/ordered/task list）                                                       |
| `src/plugins/codeblock/plugin/index.ts`        | CodeblockPlugin：element transformer（code fence）                                                                    |
| `src/plugins/link/plugin/index.ts`             | LinkPlugin：text-match transformer（`[text](url)`）                                                                   |
| `src/plugins/hr/plugin/index.ts`               | HrPlugin：element transformer（`---` / `***`）                                                                        |
| `src/plugins/math/plugin/index.ts`             | MathPlugin：text-match（inline `$...$`）+ element（block `$$`）                                                       |

## 三种 Transformer 类型

| 类型            | 触发时机                                       | 示例                                                       | 注册方                                                          |
| --------------- | ---------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| **element**     | 输入空格（默认）或 Enter（`trigger: 'enter'`） | `# ` → heading, `- ` → list, `---` + Enter → hr            | CommonPlugin, ListPlugin, CodeblockPlugin, HrPlugin, MathPlugin |
| **text-match**  | 输入 `trigger` 指定字符时                      | `![](url)` 输入 `)` → image, `[text](url)` 输入 `)` → link | ImagePlugin, LinkPlugin, MathPlugin(inline)                     |
| **text-format** | 输入 `tag` 末尾字符时                          | `**text**` → bold, `~~text~~` → strikethrough              | CommonPlugin                                                    |

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

### 路径 2：Enter 键 KEY_ENTER_COMMAND

```
用户按 Enter
    │
    ▼
KEY_ENTER_COMMAND @ CRITICAL priority (markdown/plugin/index.ts:217)
    │
    ▼
service.testTransformers(parentNode, anchorNode, offset, 'enter')
    │
    ├─ 仅检查 element transformers（trigger === 'enter'）
    ├─ 不检查 text-match / text-format
    │
    ▼
匹配？→ queueMicrotask → editor.update → service.runTransformers('enter')
未匹配？→ return false（不拦截 Enter，正常插入换行）
```

**注意**：`testTransformers` / `runTransformers` 在 `trigger === 'enter'` 时**只跑 element transformers**。因此 text-match 类型的 image/link transformer 不会在 Enter 时触发。

## 粘贴 Markdown 转换

```
用户粘贴
    │
    ▼
PASTE_COMMAND @ CRITICAL priority (markdown/plugin/index.ts:270)
    │
    ├─ hasRichHTML()? → return（保留原生富文本粘贴）
    ├─ !text? → return
    │
    ▼
直接 dispatchCommand(INSERT_MARKDOWN_COMMAND, { markdown: text })
（评分系统已移除，有文本就尝试转换）
```

**关键文件**：`src/plugins/markdown/plugin/index.ts:270-331`

## ImagePlugin 的 text-match transformer

```typescript
// src/plugins/image/plugin/index.ts:164-178
markdownService.registerMarkdownShortCut({
  type: 'text-match',
  regExp: /!\[([^\]]*)\]\(([^)]*)\)/, // 空 URL 也能匹配
  replace: (node, match) => {
    const [, altText, src] = match;
    const imageNode = defaultBlockImage
      ? $createBlockImageNode({ altText, src, status: 'uploaded' })
      : $createImageNode({ altText, src, status: 'uploaded' });
    node.replace(imageNode);
  },
  trigger: ')', // 输入 ) 触发
});
```

### 转换流程

```
输入 ![](url) 后输入 )
    │
    ▼
runTextMatchTransformers：lastChar = ')' → 查找 trigger[)'] → 找到 image transformer
    │
    ▼
文本内容匹配 regExp /!\[([^\]]*)\]\(([^)]*)\)/
    │
    ▼
splitText 切分出匹配范围 → replace(matchedNode, match) → 创建 ImageNode/BlockImageNode
```

## Transformer 注册一览表

| 语法                  | Transformer 类型 | Trigger | 注册方          | 说明                             |
| --------------------- | ---------------- | ------- | --------------- | -------------------------------- |
| `# ` \~ `###### `     | element          | 空格    | CommonPlugin    | heading                          |
| `> `                  | element          | 空格    | CommonPlugin    | blockquote                       |
| `- ` / `* ` / `+ `    | element          | 空格    | ListPlugin      | unordered list                   |
| `1. `                 | element          | 空格    | ListPlugin      | ordered list                     |
| `- [ ] ` / `- [x] `   | element          | 空格    | ListPlugin      | task list                        |
| `\`\`\`lang\`         | element          | Enter   | CodeblockPlugin | code fence                       |
| `---` / `***` / `___` | element          | Enter   | HrPlugin        | horizontal rule                  |
| `$$`                  | element          | Enter   | MathPlugin      | math block                       |
| `**text**`            | text-format      | `*`     | CommonPlugin    | bold                             |
| `*text*`              | text-format      | `*`     | CommonPlugin    | italic                           |
| `~~text~~`            | text-format      | `~`     | CommonPlugin    | strikethrough                    |
| `[text](url)`         | text-match       | `)`     | LinkPlugin      | link                             |
| `![alt](url)`         | text-match       | `)`     | ImagePlugin     | image → ImageNode/BlockImageNode |
| `$math$`              | text-match       | `$`     | MathPlugin      | inline math                      |

## 架构设计原则

**谁生产节点，谁注册 transformer**。MarkdownPlugin 只提供 `MarkdownShortCutService`（注册能力），不感知具体节点创建逻辑。各插件在自己的 `registerMarkdown()` 中注册对应的 transformer/reader/writer。
