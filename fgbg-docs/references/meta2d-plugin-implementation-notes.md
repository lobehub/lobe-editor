# Meta2d 流程图插件实现经验

> **tags**: [reference, meta2d, flow-diagram, svg-export, decorator-node, pitfall]
> **updated**: 2026-05-12

## 背景

本项目需要把 `meta2d.js/examples/diagram-editor-vue3` 的核心能力移植到 LobeHub Editor：

- 用户输入 `---meta2d---` 后插入流程图块。
- Lexical 节点保存 `diagram` JSON，用于再次编辑。
- 保存时同步导出 `svg`，预览时直接渲染 SVG。
- 预览块 hover 时显示编辑和删除按钮。

对应代码主要在：

| 文件 | 职责 |
| --- | --- |
| `src/plugins/meta2d/node/index.ts` | `Meta2dNode`，保存 `diagram` + `svg` + `autoOpenEditor` |
| `src/plugins/meta2d/plugin/index.ts` | 注册节点、markdown shortcut、markdown reader/writer |
| `src/plugins/meta2d/react/ReactMeta2dPlugin.tsx` | 注册插件并提供 decorator |
| `src/plugins/meta2d/react/DiagramEditor.tsx` | Meta2d 拖拽编辑弹窗 |
| `src/plugins/meta2d/react/DiagramPalette.tsx` | 左侧图形面板，拖拽/点击添加 pen |
| `src/plugins/meta2d/react/DiagramPreview.tsx` | SVG 预览、编辑/删除 HUD |
| `src/plugins/meta2d/utils/registerPens.ts` | 注册 flow/activity/class/sequence/chart/form/fta 图形库 |
| `src/plugins/meta2d/utils/meta2dManager.ts` | 空数据、pen 归一化、SVG 导出、数据清洗 |

## 数据流

```text
---meta2d--- + Enter
  -> MarkdownShortCutService 命中 shortcut
  -> 创建 Meta2dNode(diagram, svg, autoOpenEditor=true)
  -> React decorator 渲染 DiagramPreview
  -> autoOpenEditor 打开 DiagramEditor
  -> 用户拖拽/编辑/保存
  -> engine.data() 得到 JSON
  -> generateSvgFromMeta2d(engine) 得到 SVG
  -> node.updateDiagram(json, svg)
  -> 预览阶段直接渲染缓存 SVG
```

## 关键坑点

### 1. `DiagramEditor` 不要因父组件重渲染销毁 Meta2d 实例

老代码的问题：

```ts
useEffect(() => {
  const engine = new Meta2d(canvasRef.current, { grid: true, rule: false });
  return () => engine.destroy();
}, [diagram, onClose]);
```

`onClose` 通常来自父组件闭包，父组件重渲染后引用可能变化，导致 effect cleanup 执行，Meta2d 实例被销毁重建。表现为画布交互不稳定、拖拽状态丢失。

当前做法：

- `diagram` 只作为首次打开编辑器的初始值，用 `initialDiagramRef` 保存。
- `onClose` 用 `onCloseRef` 保存最新回调。
- 初始化 Meta2d 的 effect 使用空依赖 `[]`，实例只创建一次。

### 2. 首次打开拖入图形没有边线

现象：

- 第一次输入 `---meta2d---` 打开拖拽界面。
- 拖入 Rectangle/Circle 后画布上只显示文字，没有图形边线。
- 保存后再次编辑打开，边线又能出现。

处理方式：

- 在 `DiagramPalette` 生成拖拽 payload 前调用 `normalizeMeta2dPen()`。
- 给普通图形补默认 `color: '#1f1f1f'` 和 `lineWidth: 1`。
- 给有文字的 pen 补 `textColor`。
- `text` 类型不补默认边线，避免纯文本块出现边框。

不要只依赖 Meta2d 内部默认样式，因为拖拽新 pen 与从 JSON reopen 的计算链路不同，首次渲染可能拿不到稳定 stroke。

### 3. SVG 预览不要用隐藏实例重放作为主链路

老代码的 SVG 导出逻辑是：

1. 保存时拿 `engine.data()` 得到 JSON。
2. 新建隐藏 DOM 和隐藏 `Meta2d` 实例。
3. `open(json)`。
4. 手动遍历 `store.data.pens`，调用 `renderPenRaw(ctx, pen, rect, true)`。

这个方案有两个风险：

- 隐藏实例重放依赖 async layout / calculative 状态，容易出现坐标、相对位置和子图形计算不一致。
- 手动逐个 `renderPenRaw` 容易漏掉特殊 pen、canvas draw pen、图片/图表类 pen 的内部刷新时机。

当前主链路改为：

- 保存时优先调用 `generateSvgFromMeta2d(engine)`，直接基于用户正在编辑的 Meta2d 实例导出。
- 当前实例已经有完整的拖拽、布局和 calculative 状态，坐标关系更可靠。
- `generateSvgFromDiagram(json)` 只作为已有 JSON 缺失 SVG 时的兜底。

### 4. 预览组件不要覆盖已有 SVG

老代码中 `DiagramPreview` 会在有 `diagram` 时异步调用 `generateSvgFromDiagram(diagram)`，并通过 `onSvgReady` 写回节点。

这会导致一个隐蔽问题：

- 保存时已经生成了正确 SVG。
- 预览组件挂载后又用隐藏实例重新生成。
- 如果隐藏实例导出有坐标/漏图问题，会把正确 SVG 覆盖成错误 SVG。

当前规则：

- 如果节点已有 `svg`，`DiagramPreview` 直接信任缓存，不再后台重生成。
- 只有历史数据或 markdown reader 导入导致 `svg` 缺失时，才兜底调用 `generateSvgFromDiagram()`。

## 推荐实现原则

1. `diagram` JSON 是编辑源数据，`svg` 是展示缓存。两者都要存进 `Meta2dNode`。
2. 保存时使用当前编辑中的 `Meta2d` 实例导出 SVG，不要优先创建隐藏实例重放。
3. 对拖入画布的 pen 做最小归一化，尤其是 `color`、`lineWidth`、`textColor`。
4. 预览阶段只渲染 SVG，不要为了展示再启动 Meta2d。
5. `Meta2d` 实例生命周期必须独立于 React 父组件闭包变化。
6. `sanitizeMeta2dData()` 要删除 `calculative`、`__meta__` 这类运行时字段，避免把临时状态写进 Lexical JSON。

## 验证清单

修改 meta2d 插件后至少手动验证：

1. 输入 `---meta2d---` 后是否自动打开编辑器。
2. 第一次打开时拖入 Rectangle/Circle，是否立即显示边线。
3. 保存后 Lexical 中是否显示 SVG 预览。
4. SVG 预览中的图形数量、大小、相对位置是否和编辑器一致。
5. hover 预览块右上角是否出现编辑/删除按钮。
6. 点击编辑再次打开，JSON 是否能正确恢复。
7. 点击删除后节点是否从 Lexical 文档中移除。

建议命令：

```bash
pnpm exec eslint "src/plugins/meta2d/**/*.{ts,tsx}"
```

`pnpm type-check` 在当前项目可能会被既有 demos/tests 的 `@/` 模块解析和隐式 `any` 阻塞，判断 meta2d 改动时要区分是否为新增错误。

## 相关关键词

- `Meta2dNode`
- `ReactMeta2dPlugin`
- `DiagramEditor`
- `DiagramPreview`
- `DiagramPalette`
- `generateSvgFromMeta2d`
- `generateSvgFromDiagram`
- `normalizeMeta2dPen`
- `---meta2d---`
- `canvas2svg`
- `renderPenRaw`
