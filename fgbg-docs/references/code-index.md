# Code Index

> **tags**: \[reference, index, file-map, lookup]
> **purpose**: AI 快速通过文件路径定位功能模块

## 使用方式

如果你拿到了一个文件路径，在此表中查找它属于哪个模块、承担什么职责。

---

## 按目录索引

### src/editor-kernel/

| 文件路径                                             | 类型    | 职责                                                   | 关联文件                                      |
| ---------------------------------------------------- | ------- | ------------------------------------------------------ | --------------------------------------------- |
| `src/editor-kernel/index.ts`                         | 入口    | `Editor` 工厂对象，含 `createEditor()`                 | `src/editor-kernel/kernel.ts`                 |
| `src/editor-kernel/kernel.ts`                        | 类      | `Kernel` 类（\~892 行），实现 `IEditorKernel`          | `src/types/kernel.ts`                         |
| `src/editor-kernel/plugin.ts`                        | 抽象类  | `KernelPlugin` 插件基类                                | 所有 `src/plugins/*/plugin/index.ts`          |
| `src/editor-kernel/data-source.ts`                   | 抽象类  | `DataSource` 多格式数据源基类                          | `src/plugins/*/data-source/`                  |
| `src/editor-kernel/event.ts`                         | 模块    | `HOVER_COMMAND` 自定义 Command                         | Lexical Command 系统                          |
| `src/editor-kernel/utils.ts`                         | 工具    | DOM / 节点映射、Kernel 注册表、装饰器 reconciler       | `src/editor-kernel/kernel.ts`                 |
| `src/editor-kernel/react/react-context.ts`           | Context | `LexicalComposerContext` / `useLexicalComposerContext` | 所有 React 插件                               |
| `src/editor-kernel/react/react-editor.tsx`           | 组件    | `ReactEditor` 初始化组件                               | `src/react/Editor/Editor.tsx`                 |
| `src/editor-kernel/react/useDecorators.tsx`          | Hook    | 装饰器 → React Portal 转换                             | `src/editor-kernel/react/PortalContainer.tsx` |
| `src/editor-kernel/react/useAnchor.ts`               | Hook    | Portal 挂载点查询                                      | `src/editor-kernel/react/PortalAnchor.tsx`    |
| `src/editor-kernel/react/PortalContainer.tsx`        | 组件    | `LexicalPortalContainer`（DOM key 绑定）               | `src/editor-kernel/react/useDecorators.tsx`   |
| `src/editor-kernel/react/useLexicalNodeSelection.ts` | Hook    | 单个 Lexical 节点选区管理                              | `src/react/` 各组件                           |
| `src/editor-kernel/inode/helper.ts`                  | 工厂    | `INodeHelper` 序列化节点构造器                         | `src/editor-kernel/inode/*.ts`                |

### src/react/

| 文件路径                                              | 类型    | 职责                                 | 关联文件                                       |
| ----------------------------------------------------- | ------- | ------------------------------------ | ---------------------------------------------- |
| `src/react/Editor/Editor.tsx`                         | 组件    | 核心编辑器组件                       | `src/editor-kernel/react/react-editor.tsx`     |
| `src/react/ChatInput/ChatInput.tsx`                   | 组件    | 聊天输入框容器                       | `src/react/Editor/Editor.tsx`                  |
| `src/react/EditorProvider/index.tsx`                  | Context | 全局 locale/theme 配置               | `src/react/hooks/useEditorLocale.ts`           |
| `src/react/hooks/useEditor.ts`                        | Hook    | 创建编辑器实例                       | `src/editor-kernel/index.ts`                   |
| `src/react/hooks/useEditorState/index.ts`             | Hook    | 编辑器状态聚合（格式、历史、块类型） | Lexical `registerCommand`                      |
| `src/react/hooks/useEditorLocale/index.ts`            | Hook    | 国际化 Hook                          | `src/editor-kernel/react/useTranslation.ts`    |
| `src/react/hooks/useSize.ts`                          | Hook    | 容器尺寸监听（ResizeObserver）       | `src/react/ChatInputActions/`                  |
| `src/react/ChatInputActions/ChatInputActions.tsx`     | 组件    | 底部 / 顶部操作栏（自适应折叠）      | `src/react/hooks/useSize.ts`                   |
| `src/react/SlashMenu/SlashMenu.tsx`                   | 组件    | 斜杠命令菜单                         | `src/plugins/slash/react/ReactSlashPlugin.tsx` |
| `src/react/FloatMenu/FloatMenu.tsx`                   | 组件    | 浮动菜单 Portal 容器                 | `src/react/SlashMenu/SlashMenu.tsx`            |
| `src/react/SendButton/SendButton.tsx`                 | 组件    | 发送 / 停止按钮                      | `src/react/ChatInput/ChatInput.tsx`            |
| `src/react/CodeLanguageSelect/CodeLanguageSelect.tsx` | 组件    | 代码块语言选择器（shiki）            | `src/plugins/codeblock/`                       |
| `src/react/ColorPickerBtn.tsx`                        | 组件    | 颜色选择按钮                         | `src/react/hooks/useEditorState/index.ts`      |

### src/renderer/

| 文件路径                                      | 类型   | 职责                                            | 关联文件                                      |
| --------------------------------------------- | ------ | ----------------------------------------------- | --------------------------------------------- |
| `src/renderer/LexicalRenderer.tsx`            | 组件   | 主渲染器（JSON → React DOM）                    | `src/renderer/engine/render-tree.ts`          |
| `src/renderer/LexicalDiff.tsx`                | 组件   | 差异对比渲染器                                  | `src/renderer/diff/compute.ts`                |
| `src/renderer/engine/render-tree.ts`          | 引擎   | 渲染调度中心，递归遍历                          | `src/renderer/engine/render-builtin-node.tsx` |
| `src/renderer/engine/render-builtin-node.tsx` | 引擎   | 内置标准节点渲染                                | `src/renderer/engine/render-tree.ts`          |
| `src/renderer/engine/render-text-node.tsx`    | 引擎   | 文本节点格式解析                                | `src/renderer/engine/render-tree.ts`          |
| `src/renderer/engine/shiki.ts`                | 引擎   | Shiki 语言加载（同步）                          | `src/renderer/renderers/codeblock.tsx`        |
| `src/renderer/renderers/index.ts`             | 注册   | `RendererRegistry` / `createDefaultRenderers()` | `src/renderer/LexicalRenderer.tsx`            |
| `src/renderer/renderers/codeblock.tsx`        | 渲染器 | 代码块渲染（Highlighter）                       | `src/renderer/engine/shiki.ts`                |
| `src/renderer/renderers/image.tsx`            | 渲染器 | 图片渲染                                        | `src/renderer/LexicalRenderer.tsx`            |
| `src/renderer/renderers/math.tsx`             | 渲染器 | KaTeX 公式渲染                                  | `src/renderer/LexicalRenderer.tsx`            |
| `src/renderer/renderers/mermaid.tsx`          | 渲染器 | Mermaid 图表渲染                                | `src/renderer/LexicalRenderer.tsx`            |
| `src/renderer/renderers/mention.tsx`          | 渲染器 | 提及渲染                                        | `src/renderer/LexicalRenderer.tsx`            |
| `src/renderer/renderers/file.tsx`             | 渲染器 | 文件节点渲染                                    | `src/renderer/LexicalRenderer.tsx`            |
| `src/renderer/nodes/index.ts`                 | 配置   | Headless Editor 节点注册表                      | `src/renderer/LexicalRenderer.tsx`            |
| `src/renderer/diff/compute.ts`                | 算法   | LCS 差异计算核心                                | `src/renderer/LexicalDiff.tsx`                |
| `src/renderer/diff/style.ts`                  | 样式   | 差异视图 CSS-in-JS                              | `src/renderer/LexicalDiff.tsx`                |

### src/headless/

| 文件路径                            | 类型 | 职责                              | 关联文件                                |
| ----------------------------------- | ---- | --------------------------------- | --------------------------------------- |
| `src/headless/index.ts`             | 类   | `HeadlessEditor` 类与默认插件列表 | `src/editor-kernel/kernel.ts`           |
| `src/headless/plugins/codeblock.ts` | 插件 | Headless 专用代码块插件           | `src/plugins/codeblock/plugin/index.ts` |

### src/plugins/（核心插件）

| 文件路径                                                | 类型   | 职责                                                                | 关联文件                                                |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------- | ------------------------------------------------------- |
| `src/plugins/common/plugin/index.ts`                    | 插件   | 基础节点、数据源、历史、粘贴                                        | `src/editor-kernel/data-source.ts`                      |
| `src/plugins/common/node/cursor.ts`                     | 节点   | `CursorNode`                                                        | `src/plugins/common/plugin/index.ts`                    |
| `src/plugins/common/react/MermaidWithErrorBoundary.tsx` | React  | Mermaid parse/render + 内联 SVG + 全屏预览浮层                    | `src/plugins/codemirror-block/react/CodemirrorNode.tsx`；`src/renderer/renderers/MermaidPreviewBlock.tsx` |
| `src/plugins/markdown/plugin/index.ts`                  | 插件   | Markdown 中枢                                                       | `src/plugins/markdown/service/shortcut.ts`              |
| `src/plugins/markdown/react/PasteMarkdownConfirm.tsx`   | 组件   | 粘贴确认弹窗（i18n / 暗色主题）                                     | `src/react/Editor/Editor.tsx`                           |
| `src/plugins/markdown/service/shortcut.ts`              | 服务   | `MarkdownShortCutService`                                           | 所有注册 Markdown 读写的插件                            |
| `src/plugins/markdown/data-source/markdown/parse.ts`    | 解析   | mdast → Lexical JSON                                                | `src/plugins/markdown/plugin/index.ts`                  |
| `src/plugins/slash/plugin/index.ts`                     | 插件   | `/` 斜杠命令                                                        | `src/plugins/slash/service/i-slash-service.ts`          |
| `src/plugins/slash/service/i-slash-service.ts`          | 服务   | `SlashService` + Fuse.js 搜索                                       | `src/plugins/slash/react/ReactSlashPlugin.tsx`          |
| `src/plugins/slash/react/ReactSlashPlugin.tsx`          | React  | Slash 菜单 UI                                                       | `src/react/SlashMenu/SlashMenu.tsx`                     |
| `src/plugins/mention/plugin/index.ts`                   | 插件   | `@` 提及                                                            | `src/plugins/mention/node/MentionNode.ts`               |
| `src/plugins/mention/node/MentionNode.ts`               | 节点   | `MentionNode`（DecoratorNode）                                      | `src/plugins/mention/react/ReactMentionPlugin.tsx`      |
| `src/plugins/codeblock/plugin/index.ts`                 | 插件   | 代码块 + Shiki 高亮                                                 | `src/plugins/codeblock/plugin/CodeHighlighterShiki.ts`  |
| `src/plugins/codeblock/plugin/CodeHighlighterShiki.ts`  | 高亮器 | Shiki Tokenizer                                                     | `src/plugins/codeblock/plugin/index.ts`                 |
| `src/plugins/table/plugin/index.ts`                     | 插件   | 表格编辑                                                            | `@lexical/table`                                        |
| `src/plugins/table/node/index.ts`                       | 节点   | `TableNode` + patch                                                 | `src/plugins/table/plugin/index.ts`                     |
| `src/plugins/toolbar/react/index.tsx`                   | React  | 浮动工具栏                                                          | `src/react/hooks/useEditorState/index.ts`               |
| `src/plugins/link/plugin/index.ts`                      | 插件   | 链接编辑                                                            | `src/plugins/link-highlight/`                           |
| `src/plugins/common/plugin/paste-handler.ts`            | 模块   | 粘贴中间件链（file/VSCode/plaintext）                               | `src/plugins/common/plugin/index.ts`                    |
| `src/plugins/image/plugin/index.ts`                     | 插件   | 图片（含 `registerImageUrlPaste` 图片 URL 粘贴检测）                | `src/renderer/renderers/image.tsx`                      |
| `src/plugins/image/react/components/LazyImage.tsx`      | React  | 图片懒加载组件                                                      | `src/plugins/image/react/components/useSupenseImage.ts` |
| `src/plugins/image/react/components/useSupenseImage.ts` | Hook   | Suspense 图片加载，**全局 `imageCache` Map 会永久缓存加载失败状态** | `src/plugins/image/react/components/LazyImage.tsx`      |
| `src/plugins/math/plugin/index.ts`                      | 插件   | KaTeX 公式                                                          | `src/renderer/renderers/math.tsx`                       |
| `src/plugins/meta2d/plugin/index.ts`                    | 插件   | Meta2d 流程图节点、`---meta2d---` shortcut、markdown reader/writer | `src/plugins/meta2d/node/index.ts`                      |
| `src/plugins/meta2d/react/DiagramEditor.tsx`            | React  | Meta2d 拖拽编辑弹窗，保存时导出 JSON + SVG                         | `src/plugins/meta2d/utils/meta2dManager.ts`             |
| `src/plugins/meta2d/react/DiagramPreview.tsx`           | React  | SVG 预览与 hover 编辑/删除按钮                                      | `src/plugins/meta2d/react/ReactMeta2dPlugin.tsx`        |
| `src/plugins/meta2d/utils/meta2dManager.ts`             | 工具   | pen 归一化、数据清洗、当前 Meta2d 实例导出 SVG                     | `fgbg-docs/references/meta2d-plugin-implementation-notes.md` |
| `src/plugins/mermaid/plugin/index.ts`                   | 插件   | Mermaid 图表                                                        | `src/renderer/renderers/mermaid.tsx`                    |
| `src/plugins/upload/plugin/index.ts`                    | 插件   | 上传逻辑                                                            | `src/plugins/image/`, `src/plugins/file/`               |

### src/types/

| 文件路径                                    | 类型   | 职责                                                                    |
| ------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| `src/types/kernel.ts`                       | 类型   | `IEditor`, `IEditorKernel`, `IEditorPlugin`, `IServiceID`, `IDecorator` |
| `src/types/locale.ts`                       | 类型   | `ILocaleKeys`, `TFunction`, `LocaleType`                                |
| `src/locale/index.ts`                       | locale | en-US 默认 locale 对象，含 100+ 翻译键                                  |
| `src/locale/zh-CN.ts`                       | locale | zh-CN locale 对象，键结构与 en-US 完全一致                              |
| `src/editor-kernel/react/useTranslation.ts` | hook   | `useTranslation()` → `TFunction`                                        |
| `src/types/hotkey.ts`                       | 类型   | `HotkeyId`, `HotkeyItem`, `ModifierCombination`                         |
| `src/types/global.d.ts`                     | 声明   | mdast 扩展、antd-style、图片模块、**DEV**                               |

### src/utils/

| 文件路径                             | 类型 | 职责                                              |
| ------------------------------------ | ---- | ------------------------------------------------- |
| `src/utils/debug.ts`                 | 工具 | `DebugLogger`, `debugLogger`, `createDebugLogger` |
| `src/utils/hotkey/registerHotkey.ts` | 工具 | 热键注册与查询                                    |
| `src/utils/hotkey/parseHotkeys.ts`   | 工具 | 热键字符串解析                                    |
| `src/utils/hotkey/isHotkeyMatch.ts`  | 工具 | 事件与热键匹配判断                                |
| `src/utils/scrollIntoView.ts`        | 工具 | 选区滚动定位                                      |
| `src/utils/updatePosition.ts`        | 工具 | 浮动元素定位（@floating-ui/dom）                  |
| `src/utils/url.ts`                   | 工具 | `isValidUrl`, `isPureUrl`                         |
| `src/utils/cx.ts`                    | 工具 | className 合并                                    |

### src/const/

| 文件路径              | 类型 | 职责                                       |
| --------------------- | ---- | ------------------------------------------ |
| `src/const/hotkey.ts` | 常量 | `HOTKEYS_REGISTRATION` 全局热键表（11 条） |

---

## 按功能反向索引

### "我想找 Markdown 相关的代码"

| 功能                             | 文件                                                  |
| -------------------------------- | ----------------------------------------------------- |
| Markdown 实时快捷转换            | `src/plugins/markdown/plugin/index.ts`                |
| Markdown 粘贴检测                | `src/plugins/markdown/plugin/index.ts`                |
| Markdown 粘贴确认弹窗            | `src/plugins/markdown/react/PasteMarkdownConfirm.tsx` |
| Markdown 复制导出                | `src/plugins/markdown/plugin/index.ts`                |
| Markdown 解析（mdast → Lexical） | `src/plugins/markdown/data-source/markdown/parse.ts`  |
| Markdown 服务注册中心            | `src/plugins/markdown/service/shortcut.ts`            |
| Markdown 数据源读写              | `src/plugins/markdown/data-source/`                   |

### "我想找插件注册相关的代码"

| 功能             | 文件                                                                  |
| ---------------- | --------------------------------------------------------------------- |
| 插件基类         | `src/editor-kernel/plugin.ts`                                         |
| 插件注册与管理   | `src/editor-kernel/kernel.ts`（`registerPlugin` / `registerPlugins`） |
| 插件类型定义     | `src/types/kernel.ts`（`IEditorPlugin`, `IEditorPluginConstructor`）  |
| React 层插件注册 | `src/editor-kernel/react/react-editor.tsx`                            |

### "我想找选区 / Selection 相关的代码"

| 功能            | 文件                                                            |
| --------------- | --------------------------------------------------------------- |
| Kernel 选区操作 | `src/editor-kernel/kernel.ts`（`setSelection`, `getSelection`） |
| 选区类型定义    | `src/types/kernel.ts`（`ISelectionObject`）                     |
| 节点选区 Hook   | `src/editor-kernel/react/useLexicalNodeSelection.ts`            |
| 浮动工具栏定位  | `src/plugins/toolbar/react/index.tsx`                           |
| 滚动到选区      | `src/utils/scrollIntoView.ts`                                   |

### "我想找 Decorator/Portal 相关的代码"

| 功能                              | 文件                                               |
| --------------------------------- | -------------------------------------------------- |
| 装饰器注册与管理                  | `src/editor-kernel/kernel.ts`                      |
| 装饰器 → React Portal             | `src/editor-kernel/react/useDecorators.tsx`        |
| Portal 挂载点                     | `src/editor-kernel/react/useAnchor.ts`             |
| Portal 容器                       | `src/editor-kernel/react/PortalContainer.tsx`      |
| MentionNode（DecoratorNode 示例） | `src/plugins/mention/node/MentionNode.ts`          |
| Mention 装饰器注册                | `src/plugins/mention/react/ReactMentionPlugin.tsx` |

### "我想找 Diff / 对比 相关的代码"

| 功能          | 文件                           |
| ------------- | ------------------------------ |
| Diff 组件入口 | `src/renderer/LexicalDiff.tsx` |
| Diff 算法核心 | `src/renderer/diff/compute.ts` |
| Diff 样式     | `src/renderer/diff/style.ts`   |
| Diff 类型定义 | `src/renderer/diff/types.ts`   |

### "我想找 Headless/SSR 相关的代码"

| 功能                | 文件                                            |
| ------------------- | ----------------------------------------------- |
| HeadlessEditor 封装 | `src/headless/index.ts`                         |
| Headless 代码块插件 | `src/headless/plugins/codeblock.ts`             |
| Headless 环境判断   | 各插件 `onInit` 中的 `isHeadlessEditor(editor)` |
| 只读渲染器          | `src/renderer/LexicalRenderer.tsx`              |

### "我想找 i18n / 国际化 相关的代码"

| 功能                | 文件                                                             |
| ------------------- | ---------------------------------------------------------------- |
| en-US 默认 locale   | `src/locale/index.ts`                                            |
| zh-CN locale        | `src/locale/zh-CN.ts`                                            |
| 翻译函数 Hook       | `src/editor-kernel/react/useTranslation.ts`                      |
| locale 类型定义     | `src/types/locale.ts`                                            |
| Kernel t () 实现    | `src/editor-kernel/kernel.ts`（`t()` 方法 + `registerLocale()`） |
| EditorProvider 配置 | `src/react/EditorProvider/index.tsx`                             |
| 语言切换 Hook       | `src/react/hooks/useEditorLocale/index.ts`                       |
| 新增翻译键步骤      | 见 `fgbg-docs/references/i18n-system.md`                         |

### "我想找 Meta2d / 流程图相关的代码"

| 功能 | 文件 |
| --- | --- |
| Meta2d 插件经验与坑点 | `fgbg-docs/references/meta2d-plugin-implementation-notes.md` |
| Lexical 节点数据结构 | `src/plugins/meta2d/node/index.ts` |
| `---meta2d---` shortcut / markdown 读写 | `src/plugins/meta2d/plugin/index.ts` |
| React 插件注册与 decorator | `src/plugins/meta2d/react/ReactMeta2dPlugin.tsx` |
| 拖拽编辑器弹窗 | `src/plugins/meta2d/react/DiagramEditor.tsx` |
| SVG 预览与编辑/删除按钮 | `src/plugins/meta2d/react/DiagramPreview.tsx` |
| 图形面板与拖拽 payload | `src/plugins/meta2d/react/DiagramPalette.tsx` |
| 图形库注册 | `src/plugins/meta2d/utils/registerPens.ts` |
| SVG 导出 / pen 归一化 / 数据清洗 | `src/plugins/meta2d/utils/meta2dManager.ts` |
