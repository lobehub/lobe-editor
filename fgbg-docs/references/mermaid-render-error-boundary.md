# Mermaid 渲染失败与灰色占位图兜底

> **tags**: \[reference, mermaid, render-error, error-boundary, lobe-ui]
> **updated**: 2026-05-09

## 问题现象

Mermaid 代码块在部分非法或特殊语法下不会显示错误提示，而是显示灰色图片占位图。

典型现象：

- `mermaid.parse(code)` 返回成功，控制台看到 parse success。
- 页面下方 Mermaid 预览区域显示灰色占位图。
- 不进入 React ErrorBoundary，也不显示自定义红色错误框。

这类问题和普通解析错误不同：

- 普通解析错误：`mermaid.parse()` reject /throw，可以被外层捕获并展示错误。
- 灰色占位图：`parse()` 成功，但 `render()` 失败或产物为空，被 `@lobehub/ui` 内部吞掉。

## 根因

`@lobehub/ui` 的 Mermaid 组件内部通过 `useMermaid` 完成渲染。它的逻辑大致是：

```ts
try {
  if (await mermaidInstance.parse(content)) {
    mermaidInstance.initialize(mermaidConfig);
    const { svg } = await mermaidInstance.render(id, content);
    return svg;
  }
} catch (error_) {
  console.error('Mermaid 解析错误:', error_);
  return '';
}
```

关键点：

1. `render()` 阶段失败会被内部 catch。
2. catch 后返回空字符串 `''`。
3. 外层 React ErrorBoundary 捕获不到，因为没有 throw 到 React render 阶段。
4. `StaticMermaid` 收到空数据后展示占位图，用户看不到错误信息。

因此只做 `mermaid.parse()` 预校验不够；只包 React ErrorBoundary 也不够。

## 解决方案

新增 / 增强 `MermaidWithErrorBoundary`，不要依赖 `@lobehub/ui` 内部 `SyntaxMermaid/useMermaid` 的渲染结果。

包装组件自己执行：

```ts
await mermaid.parse(code);
const { svg } = await mermaid.render(renderId, code);
```

然后分支处理：

- 成功：通过 `@lobehub/ui` 的 `Mermaid` 组件 `bodyRender` 插槽，把已渲染的 SVG 注入进去。
- 失败：保存 Error state，展示红色错误提示框。
- 空代码：返回 `null`。

这样既保留了 `@lobehub/ui` Mermaid 外壳（语言标签、复制按钮等），又绕开了内部吞错误导致的灰色占位图。

## 改动代码文件

### `src/plugins/common/react/MermaidWithErrorBoundary.tsx`

职责：统一 Mermaid 渲染兜底组件。

核心改动：

- 使用 `mermaid.parse(code)` 捕获解析阶段错误。
- 使用 `mermaid.render(renderId, code)` 捕获渲染阶段错误。
- 用 `bodyRender` 注入已生成的 SVG，避免再次走 `@lobehub/ui` 内部 `useMermaid`。
- 用 Class ErrorBoundary 兜底 React 渲染期异常。
- 失败时显示统一红色错误框。

关键模式：

```tsx
const [error, setError] = useState<Error | null>(null);
const [svg, setSvg] = useState<string>('');

useEffect(() => {
  let canceled = false;
  setError(null);
  setSvg('');

  Promise.resolve()
    .then(async () => {
      await mermaid.parse(code);
      return mermaid.render(renderId, code);
    })
    .then(
      ({ svg }) => {
        if (!canceled) setSvg(svg);
      },
      (error) => {
        if (!canceled) setError(error instanceof Error ? error : new Error(String(error)));
      },
    );

  return () => {
    canceled = true;
  };
}, [code, renderId]);
```

成功渲染时：

```tsx
<Mermaid
  {...props}
  bodyRender={() => (
    <div
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ overflow: 'auto', padding: 16, width: '100%' }}
    />
  )}
>
  {code}
</Mermaid>
```

### `src/plugins/codemirror-block/react/CodemirrorNode.tsx`

职责：编辑态 CodeMirror 代码块内 Mermaid 实时预览。

改动：

- 将直接使用 `@lobehub/ui` 的 `Mermaid` 替换为 `MermaidWithErrorBoundary`。
- 使编辑态预览遇到 parse/render 失败时显示红色错误框，而不是灰色占位图。

### `src/renderer/renderers/MermaidPreviewBlock.tsx`

职责：只读渲染态 Mermaid 预览。

改动：

- 将直接使用 `@lobehub/ui` 的 `Mermaid` 替换为 `MermaidWithErrorBoundary`。
- 使 renderer 场景也复用同一套错误处理逻辑。

### `src/plugins/common/react/index.ts`

职责：common React 组件统一导出。

改动：

- 导出 `MermaidWithErrorBoundary`，方便其他模块复用。

## 排查经验

### 1. 不要只看 `parse()`

Mermaid 有两阶段：

1. `parse()`：识别语法 / 图类型。
2. `render()`：实际生成 SVG。

`parse success` 不代表最终能成功显示。

### 2. ErrorBoundary 只能捕获 React 渲染期错误

如果第三方组件在 async hook 里 catch 了异常并返回空值，ErrorBoundary 捕获不到。

### 3. 灰色占位图优先怀疑 “内部吞错 + 空渲染结果”

当 UI 显示图片占位但没有自定义错误框时，应检查第三方组件是否：

- catch 了异常；
- `console.error` 后返回空字符串；
- 用空字符串驱动 loading/placeholder UI。

### 4. 调试日志建议

排查 Mermaid 链路时可临时打印：

```ts
console.warn('[MermaidWithErrorBoundary] parse start', { code });
console.warn('[MermaidWithErrorBoundary] parse success', { code });
console.warn('[MermaidWithErrorBoundary] parse error', { code, error });
console.warn('[MermaidWithErrorBoundary] render fallback', { error });
```

若看到 `parse success` 但页面仍灰图，下一步必须验证 `render()`。

## AI 检索关键词

- Mermaid 灰色占位图
- Mermaid parse success 但渲染失败
- `@lobehub/ui` Mermaid 吞错误
- `useMermaid` 返回空字符串
- Mermaid ErrorBoundary 不生效
- Mermaid `bodyRender` 注入 SVG
- CodeMirror Mermaid 预览错误提示

## 相关

- **全屏大图预览**（缩放、拖拽、`foreignObject` 与 antd Image 不适用说明）：[`mermaid-preview-overlay.md`](./mermaid-preview-overlay.md)