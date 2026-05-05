# Codeblock Plugin

> **tags**: \[plugin, codeblock, shiki, syntax-highlight, code]
> **related_modules**: \[src/plugins/codeblock, src/plugins/codeblock/plugin/CodeHighlighterShiki.ts]

## 定位

`CodeblockPlugin` 提供**代码块编辑与渲染**，基于 `@lexical/code-core` 的 `CodeNode` / `CodeHighlightNode`，集成 **Shiki** 语法高亮。Headless 环境使用 `HeadlessCodeblockPlugin`（无高亮、无粘贴拦截）。

## 核心文件

| 文件                                                   | 类型     | 核心内容             |
| ------------------------------------------------------ | -------- | -------------------- |
| `src/plugins/codeblock/plugin/index.ts`                | 插件类   | `CodeblockPlugin`    |
| `src/plugins/codeblock/plugin/CodeHighlighterShiki.ts` | 高亮器   | Shiki Tokenizer 封装 |
| `src/plugins/codeblock/react/ReactCodeblockPlugin.tsx` | React 层 | 注册器（无复杂 UI）  |

## Shiki 高亮流程

```
代码块内容变化
    │
    ▼
registerUpdateListener
    │
    ▼
CodeHighlighterShiki.tokenize(code, language)
    │
    ▼
Shiki 生成 Token 数组（按语法着色）
    │
    ▼
转换为 CodeHighlightNode 树
    │
    ▼
LexicalEditor.update(() => { $setSelection(null); ... })
    │
    ▼
DOM 更新为带 syntax highlighting 的代码块
```

## Headless 差异

| 能力                        | 浏览器端 | Headless |
| --------------------------- | -------- | -------- |
| Shiki 高亮                  | ✅       | ❌       |
| 粘贴拦截（纯文本进代码块）  | ✅       | ❌       |
| Markdown 快捷方式（\`\`\`） | ✅       | ✅       |
| Markdown 读写               | ✅       | ✅       |
| 语言检测                    | ✅       | ❌       |

## Markdown 支持

````markdown
```typescript
const x = 1;
```
````

````

读取时：`MarkdownReader` 解析为 `CodeNode` + `CodeHighlightNode`
写入时：`MarkdownWriter` 遍历代码块节点生成 ``` 语法

## React 层

`ReactCodeblockPlugin` 主要是注册器，无复杂 UI。代码块的视觉样式通过 `theme.code` 注入。

语言选择器是独立的 `CodeLanguageSelect` 组件（`src/react/CodeLanguageSelect/`），基于 `shiki` 的 `bundledLanguagesInfo` 生成选项。
````
