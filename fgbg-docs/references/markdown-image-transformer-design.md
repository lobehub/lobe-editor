# Markdown 图片语法转换设计

> **tags**: \[reference, design, markdown, image, lexical, transformer, text-match, plugin-collaboration]
> **purpose**: 记录 `![](url)` markdown 语法在实时输入时转换为 Lexical ImageNode/BlockImageNode 的设计方案和关键决策。

## 问题

在编辑器中输入 `![alt](url)` 后，它仍然是普通文本，不会渲染为图片。期望的效果是：输入完整的 `![](url)` 后，自动转换为 BlockImageNode 并显示图片。

## 数据流

```
输入 ![](url)
     │
     ▼
Lexical TextNode (普通文本)
     │
     ▼  textMatchTransformer 匹配
     │
     ▼
BlockImageNode { type: "block-image", src, altText, ... }
     │
     ▼ 序列化
     │
JSON: { "type": "block-image", "version": 1, "src": "...", "altText": "...", ... }
```

### 图片节点 JSON 结构

```json
{
  "altText": "image.png",
  "height": 0,
  "maxWidth": 1426,
  "src": "/api/assets/uuid.png",
  "type": "block-image",
  "version": 1,
  "width": 0
}
```

## 架构设计：谁负责注册 transformer

### 核心原则：谁生产节点，谁注册 markdown transformer

各插件的 transformer 注册职责划分：

| 语法           | 生产节点                   | 注册方          | Transformer 类型 |
| -------------- | -------------------------- | --------------- | ---------------- |
| `**bold**`     | TextNode(format=bold)      | CommonPlugin    | text-format      |
| `*italic*`     | TextNode(format=italic)    | CommonPlugin    | text-format      |
| `- list`       | ListNode                   | ListPlugin      | element          |
| ` ```code``` ` | CodeBlockNode              | CodeblockPlugin | element          |
| `![](url)`     | BlockImageNode / ImageNode | **ImagePlugin** | **text-match**   |

### 为什么不放在 MarkdownPlugin

- MarkdownPlugin 只提供 `MarkdownShortCutService`（注册能力）和粘贴检测，不感知具体节点的创建逻辑
- 如果 MarkdownPlugin import `$createBlockImageNode`，就产生了对 ImagePlugin 的反向依赖
- ImagePlugin 已经在 `registerMarkdown()` 中注册了 `markdownReader['image']`（给数据源用），再加一个 `textMatchTransformer`（给实时打字用）是同一层的扩展

### 架构分层

```
MarkdownPlugin
  └─ MarkdownShortCutService（提供 registerMarkdownShortCut 能力）
        ├─ CommonPlugin   → text-format transformers（粗体/斜体）
        ├─ ListPlugin     → element transformer（列表）
        ├─ CodeblockPlugin→ element transformer（代码块）
        └─ ImagePlugin    → text-match transformer（图片） ← 本方案
```

## ImagePlugin 的 Markdown 注册点

`src/plugins/image/plugin/index.ts` 中的 `registerMarkdown()` 方法目前注册了：

```typescript
private registerMarkdown() {
  const defaultBlockImage = this.config?.defaultBlockImage !== false;
  const markdownService = this.kernel.requireService(IMarkdownShortCutService);
  if (!markdownService) return;

  // 已有：Markdown 写入（getDocument 导出时用）
  markdownService.registerMarkdownWriter(ImageNode.getType(), ...);
  markdownService.registerMarkdownWriter(BlockImageNode.getType(), ...);

  // 已有：Markdown 读取（数据源 import 时用，走 remark 解析）
  markdownService.registerMarkdownReader('image', ...);
}
```

需要新增 `textMatchTransformer`：

```typescript
markdownService.registerMarkdownShortCut({
  type: 'text-match',
  regExp: /!\[([^\]]*)\]\(([^)]*)\)/,
  replace: (node, match) => {
    const [, altText, src] = match;
    const imageNode = defaultBlockImage
      ? $createBlockImageNode({ altText, src, status: 'uploaded' })
      : $createImageNode({ altText, src, status: 'uploaded' });
    node.replace(imageNode);
  },
  trigger: ')', // 输入 ) 时触发匹配
});
```

## textMatchTransformer 工作机制

### 触发条件

1. 用户输入 `)` — 在 `MarkdownShortCutService.runTextMatchTransformers` 中，按 `trigger` 字符索引
2. 匹配当前 TextNode 中光标前的文本内容，应用 `regExp` 进行正则匹配
3. 匹配成功后，将匹配范围的文本从 TextNode 中切分出来，调用 `replace`

### 替换流程

```
输入 ![](url) 后按 )
                    │
                    ▼
TextNode 内容: "![](url)"
                    │
                    ▼  regExp 匹配
                    │
                    ▼
splitText 切分出匹配范围的文本节点
                    │
                    ▼
replace(matchedNode, match)
  → 创建 BlockImageNode
  → node.replace(imageNode) 替换
                    │
                    ▼
Lexical 节点树: 原 TextNode → BlockImageNode
```

### 边界情况

- **URL 含 `)`**：regex `([^)]*)` 使用的是一行匹配，URL 中出现 `)` 会截断，与标准 markdown 行为一致
- **空 alt / 空 url**：`![]()` → altText = "", src =""，regex 允许 URL 为空，可正常创建空 ImageNode
- **inline vs block**：通过 `config.defaultBlockImage` 控制，默认 block-image

## 涉及文件

### 核心修改

| 文件                                | 操作                      | 说明                      |
| ----------------------------------- | ------------------------- | ------------------------- |
| `src/plugins/image/plugin/index.ts` | 修改 `registerMarkdown()` | 追加 textMatchTransformer |

### 相关上下游文件（供 AI 查询上下文）

| 文件                                                    | 说明                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/plugins/image/node/image-node.tsx`                 | ImageNode                                                                 |
| `src/plugins/image/node/block-image-node.tsx`           | BlockImageNode                                                            |
| `src/plugins/image/node/basie-image-node.ts`            | BaseImageNode（基类）                                                     |
| `src/plugins/image/react/components/LazyImage.tsx`      | 图片渲染组件                                                              |
| `src/plugins/image/react/components/useSupenseImage.ts` | 图片加载 + 全局 cache                                                     |
| `src/plugins/markdown/service/shortcut.ts`              | MarkdownShortCutService（`registerMarkdownShortCut` / `runTransformers`） |
| `src/plugins/markdown/service/transformers.ts`          | TextMatchTransformer 类型定义 + `runTextMatchTransformers` 函数           |
| `src/plugins/markdown/plugin/index.ts`                  | MarkdownPlugin onInit，update listener 中触发 `runTransformers`           |
| `src/plugins/markdown/data-source/markdown/parse.ts`    | remark 解析路径（数据源 import 用）                                       |

## 相关文档

- [Markdown Plugin](/fgbg-docs/modules/plugins/markdown.md) — MarkdownShortCutService 细节
- [Plugin System](/fgbg-docs/modules/plugin-system.md) — 插件协作模式
- [Paste Image URL Issues](/fgbg-docs/references/paste-image-url-plugin-design.md) — 粘贴图片 URL 已知问题

---

## Bug 修复记录：输入 `![](url)` 显示为 "!+超链接" 而非图片

### 问题现象

输入完整的图片 markdown 语法 `![](https://example.com/image.jpg)` 并回车后：
- 期望：显示为图片节点（BlockImageNode / ImageNode）
- 实际：显示为 "! + 超链接"，`!` 保留为纯文本，`[text](url)` 部分被转换为 LinkNode

### 根本原因

**正则冲突 + 插件注册顺序问题**：

1. **正则冲突**：ImagePlugin 和 LinkPlugin 的 text-match transformer 使用相似的正则表达式：
   - ImagePlugin: `/!\[([^\]]*)]\(([^)]*)\)/`
   - LinkPlugin: `/\[([^[]*)]\(([^\s()]+)...\)/`
   
   当输入 `![](url)` 时，LinkPlugin 的正则可以从 `index: 1` 位置开始匹配（跳过开头的 `!`），导致两个 transformer 都能匹配成功。

2. **注册顺序**：LinkPlugin 先于 ImagePlugin 注册到 MarkdownShortCutService，而 `runTextMatchTransformers` 按注册顺序遍历并在第一个匹配后立即 `return true`。

   结果：LinkPlugin 先执行，把 `![](url)` 从 index 1 开始切割为 `[](url)` 并创建 LinkNode，开头的 `!` 保留为独立 TextNode。

### 修复方案

**在 LinkPlugin 的正则中添加负向后行断言 `(?<!!)`**（前面不能是 `!`）：

修改文件：`src/plugins/link/plugin/index.ts`

```typescript
// 修改前
regExp: /\[([^[]*)]\(([^\s()]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?\)\s?$/

// 修改后
regExp: /(?<!\!)\[([^[]*)]\(([^\s()]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?\)\s?$/
```

**原理**：负向后行断言 `(?<!\!)` 确保 `[` 字符的前面不能是 `!`，这样：
- `[text](url)` → 正常匹配（前面不是 `!`）
- `![alt](url)` → 不再匹配（前面是 `!`）

### 验证方法

```javascript
const imageRegex = /!\[([^\]]*)]\(([^)]*)\)/;
const linkRegex = /(?<!\!)\[([^[]*)]\(([^\s()]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?\)\s?$/;

// 图片语法：Image 匹配，Link 不匹配
console.log(linkRegex.test('![](https://example.com/image.jpg)')); // false
console.log(imageRegex.test('![](https://example.com/image.jpg)')); // true

// 链接语法：Link 匹配，Image 不匹配
console.log(linkRegex.test('[text](https://example.com)')); // true
console.log(imageRegex.test('[text](https://example.com)')); // false

// 带 alt 的图片语法
console.log(linkRegex.test('![alt text](https://example.com/image.jpg)')); // false
console.log(imageRegex.test('![alt text](https://example.com/image.jpg)')); // true
```

### 关键注意点

1. **负向后行断言兼容性**：现代浏览器和 Node.js 都支持 ES2018 的负向后行断言 `(?<!pattern)`
2. **正则转义**：在 TypeScript 字符串中，`!` 不需要转义，但在正则字面量中也不需要
3. **修复位置**：应该在 LinkPlugin 端修复（排除图片），而不是在 ImagePlugin 端（因为问题是 Link 错误匹配了 Image 的语法）
