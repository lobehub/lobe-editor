# Mermaid 编辑态 / 预览态「大图预览」浮层

> **tags**: \[reference, mermaid, preview, fullscreen, svg, foreignobject, codemirror]
> **updated**: 2026-05-11

## 主题

` ```mermaid ` 代码块在编辑器下方会渲染预览图。**点击预览打开全屏大图**：缩放（滚轮 + 底部按钮）、拖拽平移、右上角关闭、底部显示缩放比例。**实现放在公共 React 包里**，Codemirror Mermaid 与 LexicalRenderer 的 Mermaid 块共用同一套逻辑（均通过 `MermaidWithErrorBoundary`）。

## 涉及代码文件

| 文件 | 职责 |
| --- | --- |
| [`src/plugins/common/react/MermaidWithErrorBoundary.tsx`](../../src/plugins/common/react/MermaidWithErrorBoundary.tsx) | parse/render 兜底 + 内联 `dangerouslySetInnerHTML` 展示 SVG；`SvgPreviewOverlay`（`createPortal` 挂 `document.body`）负责全屏预览。 |
| [`src/plugins/codemirror-block/react/CodemirrorNode.tsx`](../../src/plugins/codemirror-block/react/CodemirrorNode.tsx) | 代码块预览区挂载 `MermaidWithErrorBoundary`（未改文件名时仍可检索「谁在用预览」）。 |
| [`src/renderer/renderers/MermaidPreviewBlock.tsx`](../../src/renderer/renderers/MermaidPreviewBlock.tsx) | 只读渲染 Mermaid；同样使用该包装组件。 |

## 为何不直接用 antd `Image.preview`

- **`data:image/svg+xml` → `<img src>`**：浏览器对图片上下文中的 SVG **不渲染 `<foreignObject>`**，复杂 Mermaid 常空白或失真。
- **Canvas 栅格化成 PNG**：把同类 SVG 当图片画进 canvas **同样受制**，预览图不可用。
- **antd Image + `bodyRender(imageRender)`**：预览内部缩放/拖拽依赖绑在原生 `<img>` 上的引用；整块替换自定义节点后，**工具栏缩放与滚轮与 DOM 脱节**（我们曾经踩过）。
- **结论**：全屏预览用 **内联 SVG DOM**（`dangerouslySetInnerHTML`）+ **自绘浮层**（缩放、滚轮、`pointer` 拖拽）；与错误兜底写法见 [`mermaid-render-error-boundary.md`](./mermaid-render-error-boundary.md)。

## 实现要点（便于维护）

1. **内嵌图**：外层 `bodyRender` 里直接写入 SVG，保证文案与 `<foreignObject>` 正常。
2. **预览层**：Portal 深色蒙层；白底卡片 `transform: translate + scale`；蒙层监听 `wheel` 且 `{ passive: false }` **阻止背后页面滚动**。
3. **拖拽**：外层可拖拽容器 `onPointerDown/Move/Up` + **`setPointerCapture`**；内部 SVG 子树 **`pointer-events: none`**，避免 SVG 抢走事件。
4. **别让 click 关掉浮层**：可拖拽卡片 **`onClick` 必须 `stopPropagation`**，否则会冒泡到蒙层 `onClick` → 误判关闭。
5. **区分拖动与点击蒙层**：用「是否发生过明显位移」的 ref，避免拖拽结束触发蒙层关闭。

## AI 检索关键词

`Mermaid 大图预览` `SvgPreviewOverlay` `createPortal` `foreignObject` `<img>` SVG `MermaidWithErrorBoundary` `enableImagePreview` `CodemirrorNode` `MermaidPreviewBlock`
