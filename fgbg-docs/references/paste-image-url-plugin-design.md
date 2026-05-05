# Known Issues

> **tags**: \[reference, issues, pitfalls, workaround, lexical]
> **purpose**: 记录项目中的已知坑点、特殊处理和历史原因，帮助 AI 避免重复踩坑。

## Lexical 相关

### 1. `__kernel` 注入使用了 `@ts-expect-error`

**位置**：`src/editor-kernel/kernel.ts`

```ts
createEditor({
  // @ts-expect-error
  __kernel: this,
  ...
});
```

**原因**：Lexical 的 `createEditor` config 类型没有定义 `__kernel` 字段，这是本项目自定义的注入点。
**影响**：Lexical 升级时需确认 `createEditor` 的 config 类型是否变化。

### 2. Lexical 通过 patch 做微调

**位置**：`patches/lexical@0.42.0.patch`

**原因**：Lexical 原生行为在某些场景下不符合需求，通过 pnpm patch 修改。
**影响**：升级 Lexical 版本时，需要检查 patch 是否仍然适用，可能需要重新生成 patch。

### 3. 装饰器直接操作 `editor._pendingDecorators`

**位置**：`src/editor-kernel/utils.ts` 中的 `reconcileDecorator`

**原因**：Lexical 的 decorator reconciler 在某些边界情况下不会自动触发更新，需要手动操作内部属性。
**风险**：依赖 Lexical 内部属性，升级时可能失效。

## 插件系统

### 4. 插件 `onInit` 中判断 Headless 环境的模式

**模式**：

```ts
if (!isHeadlessEditor(editor)) {
  this.register(registerTablePlugin(editor));
}
```

**注意**：这是同一套插件同时支持浏览器端和 Headless 端的关键设计。新增插件时如果涉及 DOM 操作，必须添加此判断，否则在 Headless/SSR 环境会报错。

### 5. 热重载检测逻辑依赖构建工具

**位置**：`src/editor-kernel/kernel.ts`

**原因**：Kernel 检测 Webpack/Vite/Next.js 的 HMR API 来实现插件热替换。
**影响**：如果使用其他构建工具，热重载可能不生效。

### 6. Markdown 粘贴检测的评分系统可能误识别

**位置**：`src/plugins/markdown/plugin/index.ts`

**现象**：某些非 Markdown 格式的文本可能被误识别为 Markdown 并强制转换。
**缓解**：`detectLanguage.ts` 会先检测是否为代码，如果是代码则跳过 Markdown 处理。

## React 集成

### 7. `useLexicalComposerContext` 返回的是 `IEditor` 而非 `LexicalEditor`

**位置**：`src/editor-kernel/react/react-context.ts`

**注意**：这个 Context 的命名容易误导，它存储的是 `[IEditor, LexicalComposerContextType]`，其中 `IEditor` 是 Kernel 封装后的接口，不是原生的 `LexicalEditor`。如果需要原生 LexicalEditor，应调用 `editor.getLexicalEditor()`。

### 8. Decorator 渲染依赖 PortalAnchor 的 DOM 查找

**位置**：`src/editor-kernel/react/useAnchor.ts`

**现象**：`useAnchor` 会优先查找 `root.parentElement`，回退到 `#lobehub-app` 或 `document.body`。
**风险**：如果编辑器挂载在 Shadow DOM 或 iframe 中，Portal 可能渲染到错误位置。

## Renderer

### 9. `LexicalRenderer` 内部创建独立的 Headless Editor

**位置**：`src/renderer/LexicalRenderer.tsx`

**注意**：每次渲染都会 `createHeadlessEditor()`，对于大量渲染场景（如长列表的消息气泡）可能有性能开销。目前未做实例池化或缓存优化。

### 10. Diff 算法对复杂嵌套结构的处理

**位置**：`src/renderer/diff/compute.ts`

**现象**：LCS 算法在根级做行对齐，对 deeply nested 的节点结构（如表格嵌套列表）的差异展示可能不够精细。
**缓解**：目前主要优化文本内容的字符级 diff，复杂结构以行级为主。

## 类型系统

### 11. `SerializedLexicalNode` 的扩展类型在 `global.d.ts` 中声明

**位置**：`src/types/global.d.ts`

**内容**：向 mdast 的 `BlockContentMap` / `PhrasingContentMap` 注入 `subscript` 和 `superscript`。
**注意**：这是全局类型扩展，如果与其他使用 mdast 的库冲突，可能需要调整。

## 构建与依赖

### 12. Shiki 语言加载是同步的

**位置**：`src/renderer/engine/shiki.ts`

**现象**：`loadLanguage()` 同步加载语言 grammar，首次渲染包含该语言的代码块时可能阻塞。
**缓解**：常用语言已预加载，非常用语言按需加载。

### 13. `@lobehub/ui` 依赖

**现象**：React 组件层大量依赖 `@lobehub/ui` 的组件和样式 token。
**影响**：如果要在非 LobeHub 项目中使用，可能需要处理样式兼容或替换 UI 组件。

## 粘贴 / Image

### 14. 粘贴图片 URL 无法显示图片

**位置**：

- `src/plugins/image/plugin/index.ts` — `registerImageUrlPaste`
- `src/plugins/image/react/components/useSupenseImage.ts` — `imageCache`
- `src/plugins/link-highlight/plugin/index.ts` — PASTE_COMMAND handler

**现象**：粘贴 `https://example.com/image.jpg` 到编辑器后，图片不显示，最终以 `[](url)` 链接形式呈现。

**已尝试的修改但不生效**：

1. `LinkHighlightPlugin` 的 PASTE_COMMAND handler 加了图片 URL 跳过逻辑（已回退）
2. `ImagePlugin.registerImageUrlPaste` 的 `types.length === 1 && types[0] === 'text/plain'` → `types.includes('text/plain')`
3. `ImagePlugin.registerImageUrlPaste` 优先级 `NORMAL` → `HIGH`

**可能原因**（未确认）：

1. `useLayoutEffect` 在 `ReactImagePlugin` 中只跑一次，Dumi 热更新不重新注册 PASTE_COMMAND
2. `useSuspenseImage` 的全局 `imageCache` (`Map<string, Promise<boolean> | boolean>`) 缓存错误状态后无法清除。`src/plugins/image/react/components/useSupenseImage.ts`
3. PASTE_COMMAND 被其他 handler 在更高优先级吞掉（如 CommonPlugin 的 `registerHighCommand` 内部优先级循环）
4. 构建未重新执行（`src/` 改完需 `npm run build`），但 Dumi dev 模式理论上直接引用源码

**相关文件**：

- `src/plugins/image/plugin/index.ts` — `registerImageUrlPaste()` 第 217-257 行
- `src/plugins/image/react/ReactImagePlugin.tsx` — `renderImage` 注入
- `src/plugins/image/react/components/LazyImage.tsx` — 图片渲染
- `src/plugins/image/react/components/useSupenseImage.tsx` — Suspense 图片加载 + cache
- `src/plugins/common/plugin/index.ts` — CommonPlugin PASTE_COMMAND handler（CRITICAL 优先级）
- `src/editor-kernel/kernel.ts` — `registerHighCommand` 内部优先级循环

## 测试

### 15. Headless 测试使用独立环境

**位置**：`src/headless/__tests__/headless-editor.test.ts`

**注意**：Headless 测试不依赖 DOM，但如果测试涉及需要 DOM 的插件行为（如表格选区），需要单独写浏览器端测试。
