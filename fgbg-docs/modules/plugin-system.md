# Plugin System

> **tags**: \[plugin, plugin-system, KernelPlugin, lifecycle, extension, architecture]
> **related_modules**: \[src/editor-kernel/plugin.ts, src/types/kernel.ts, src/plugins]

## 定位

本项目的插件系统是基于 `editor-kernel` 构建的**分层扩展架构**。所有编辑能力（Markdown、表格、代码块、提及等）均以插件形式实现，通过统一的注册接口挂载到编辑器内核。

## 核心抽象

### 插件接口层次

```
IEditorPlugin<IConfig>        ← 最简接口（实例级别）
    ↑
KernelPlugin (abstract class) ← 基类实现（生命周期 + 事件 + 清理）
    ↑
具体插件（SlashPlugin, MentionPlugin...）← 业务实现
```

### IEditorPlugin 接口

```ts
// src/types/kernel.ts
export interface IEditorPlugin<IConfig> {
  config?: IConfig;
  destroy(): void;
  onInit?(editor: LexicalEditor): void;
}

export interface IEditorPluginConstructor<IConfig> {
  readonly pluginName: string;
  new (kernel: IEditorKernel, config?: IConfig): IEditorPlugin<IConfig>;
}
```

### KernelPlugin 基类

```ts
// src/editor-kernel/plugin.ts
export abstract class KernelPlugin extends EventEmitter {
  protected clears: Array<() => void> = [];
  protected registeredDecorators: Set<string> = new Set();

  // 注册副作用清理函数（destroy 时自动执行）
  protected register(clear: () => void): void {
    this.clears.push(clear);
  }

  // 注册装饰器（自动追踪，便于热重载清理）
  protected registerDecorator(kernel, name, decorator): void {
    kernel.registerDecorator(name, decorator);
    this.registeredDecorators.add(name);
  }

  // 统一销毁
  public destroy(): void {
    this.clears.forEach((clear) => clear());
    this.clears = [];
    this.registeredDecorators.clear();
  }

  // 生命周期钩子
  onInit?(editor: LexicalEditor): void;
}
```

## 插件目录标准结构

每个插件遵循以下目录约定：

```
src/plugins/<name>/
├── index.ts              # 对外导出（plugin、react、command、node、type）
├── plugin/
│   └── index.ts          # 核心插件类（继承 KernelPlugin）
├── node/                 # 自定义 Lexical Node
│   └── *.ts
├── command/
│   └── index.ts          # Lexical Command 定义
├── react/                # React UI 层（可选）
│   ├── index.ts
│   ├── React<Name>Plugin.tsx
│   ├── components/
│   ├── style.ts
│   └── type.ts
├── service/              # 服务接口与实现（可选）
│   └── i-<name>-service.ts
├── utils/                # 插件私有工具
│   └── index.ts
└── demos/                # 示例数据
    ├── data.json
    └── index.tsx
```

## 插件生命周期

```
Kernel.registerPlugin(PluginClass, config)
  │
  ▼
存入 this.plugins / this.pluginsConfig（此时未实例化）
  │
  ▼
setRootElement() / initHeadlessEditor() / initNodeEditor()
  │
  ▼
实例化 PluginClass(kernel, config)
  │
  ├── constructor()
  │   ├── kernel.registerNodes([...])       # 注册自定义节点
  │   ├── kernel.registerThemes({...})      # 注册主题 CSS 映射
  │   ├── kernel.registerService(...)       # 注册服务（可选）
  │   └── this.registerDecorator(...)       # 注册装饰器（可选）
  │
  └── onInit(lexicalEditor)
      ├── editor.registerCommand(...)       # 注册命令监听
      ├── editor.registerUpdateListener(...)# 注册更新监听
      ├── kernel.registerHotkey(...)        # 注册热键
      └── this.register(() => cleanup())    # 记录所有副作用清理
  │
  ▼
运行期（用户交互）
  │
  ▼
destroy()
  └── 执行所有 clears（自动注销 listener、command、decorator）
```

## 插件与 Kernel 的交互方式

| 交互方式         | API                                                   | 用途                      | 调用时机             |
| ---------------- | ----------------------------------------------------- | ------------------------- | -------------------- |
| **注册节点**     | `kernel.registerNodes([...])`                         | 注册自定义 Lexical Node   | constructor          |
| **注册主题**     | `kernel.registerThemes({...})`                        | 为 Node 提供 CSS 类名映射 | constructor          |
| **注册装饰器**   | `kernel.registerDecorator(name, fn)`                  | 将 Node 渲染为 React 组件 | constructor          |
| **注册服务**     | `kernel.registerService(IServiceID, instance)`        | 跨插件共享能力            | constructor          |
| **消费服务**     | `kernel.requireService(IServiceID)`                   | 获取其他插件服务          | constructor / onInit |
| **注册数据源**   | `kernel.registerDataSource(new DataSource(...))`      | 支持 setDocument (type)   | constructor          |
| **注册命令**     | `editor.registerCommand(cmd, listener, priority)`     | 监听 Lexical 命令         | onInit               |
| **注册更新监听** | `editor.registerUpdateListener(cb)`                   | 监听编辑器状态变化        | onInit               |
| **注册热键**     | `kernel.registerHotkey(id, callback)`                 | 绑定快捷键                | onInit               |
| **事件通信**     | `kernel.on('event', ...)` / `kernel.emit(...)`        | 跨插件事件                | 任意                 |
| **高优先级命令** | `kernel.registerHighCommand(cmd, listener, priority)` | 插件间命令优先级管理      | onInit               |

## 插件注册方式

### 在 Kernel 层注册

```ts
kernel.registerPlugin(SlashPlugin, { trigger: '/' });
kernel.registerPlugins([[CommonPlugin, { enableHistory: true }], MarkdownPlugin, TablePlugin]);
```

### 在 React 层注册

```tsx
// 所有 React*Plugin 组件遵循此模式
const ReactXxxPlugin: FC<Props> = (props) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(XxxPlugin, {
      decorator: (node, editor) => <Component ... />,
      theme: ...,
      ...props,
    });
  }, [deps]);

  return null; // 或返回 UI 浮层
};
```

### Editor 组件的 plugins prop

```tsx
<Editor plugins={[[CustomPlugin, { option: 'value' }]]} />
```

## 插件间协作模式

### 服务共享（推荐）

```ts
// MarkdownPlugin 注册服务
kernel.registerService(MARKDOWN_SHORTCUT_SERVICE, new MarkdownShortCutService());

// TablePlugin 消费服务
const shortcutService = kernel.requireService(MARKDOWN_SHORTCUT_SERVICE);
shortcutService.registerElementTransformer({
  type: 'table',
  // ...
});
```

### 事件广播

```ts
// SlashPlugin
kernel.emit('slash:open', { position, query });

// 其他插件监听
kernel.on('slash:open', (data) => {
  // 响应 slash 菜单打开
});
```

### 命令协作

```ts
// ToolbarPlugin 监听选区变化
editor.registerCommand(
  SELECTION_CHANGE_COMMAND,
  () => {
    // 更新工具栏状态
    return false; // 不拦截，继续传播
  },
  COMMAND_PRIORITY_LOW,
);
```

## Headless 兼容

同一插件代码同时支持浏览器端和 Headless 端：

```ts
onInit(editor: LexicalEditor): void {
  if (!isHeadlessEditor(editor)) {
    // 仅在有 DOM 环境时注册
    this.register(registerTablePlugin(editor));
    this.register(registerTableSelectionObserver(editor));
  }

  // 无 DOM 依赖的逻辑始终注册
  this.register(registerMarkdownReader(editor));
}
```

## 热重载支持

开发模式下，Kernel 检测 HMR 并自动替换插件：

```ts
// kernel.ts 内部逻辑
if (isHMR()) {
  // 销毁旧插件实例
  oldPlugin.destroy();
  // 重新实例化新插件类
  kernel.registerPlugin(NewPluginClass, config);
}
```

## 开发新插件的步骤

如果你是 AI，要帮用户开发新插件，按以下步骤：

1. **创建目录**：`src/plugins/<name>/`
2. **实现 Plugin 类**：继承 `KernelPlugin`，定义 `static pluginName`
3. **定义 Node（如需）**：继承 Lexical 的 `DecoratorNode` 或 `ElementNode`
4. **注册能力**：
   - constructor 中：`registerNodes`, `registerThemes`, `registerService`
   - onInit 中：`registerCommand`, `registerUpdateListener`
5. **实现 React 层（如需 UI）**：创建 `React<Name>Plugin.tsx`
6. **注册 Markdown 支持（如需）**：实现 reader/writer 并注册到 `MarkdownShortCutService`
7. **更新 renderer**：在 `src/renderer/renderers/` 添加只读渲染器
8. **更新 rendererNodes**：在 `src/renderer/nodes/index.ts` 注册 Node

## 现有插件清单

| 插件           | 路径                          | 功能                            | 有 UI |
| -------------- | ----------------------------- | ------------------------------- | ----- |
| common         | `src/plugins/common/`         | 基础节点、数据源、历史、粘贴    | 部分  |
| markdown       | `src/plugins/markdown/`       | Markdown 解析 / 导出 / 快捷转换 | 无    |
| slash          | `src/plugins/slash/`          | `/` 斜杠命令菜单                | 有    |
| mention        | `src/plugins/mention/`        | `@` 提及                        | 有    |
| codeblock      | `src/plugins/codeblock/`      | 代码块 + Shiki 高亮             | 有    |
| code           | `src/plugins/code/`           | 行内代码                        | 无    |
| table          | `src/plugins/table/`          | 表格编辑                        | 有    |
| toolbar        | `src/plugins/toolbar/`        | 浮动格式工具栏                  | 有    |
| link           | `src/plugins/link/`           | 链接                            | 有    |
| link-highlight | `src/plugins/link-highlight/` | 链接自动高亮                    | 无    |
| image          | `src/plugins/image/`          | 图片                            | 有    |
| file           | `src/plugins/file/`           | 文件上传                        | 有    |
| hr             | `src/plugins/hr/`             | 分隔线                          | 无    |
| list           | `src/plugins/list/`           | 列表                            | 无    |
| math           | `src/plugins/math/`           | 公式（KaTeX）                   | 有    |
| mermaid        | `src/plugins/mermaid/`        | Mermaid 图表                    | 有    |
| meta2d         | `src/plugins/meta2d/`         | Meta2D 图形                     | 有    |
| outline        | `src/plugins/outline/`        | 大纲 / 目录                     | 有    |
| upload         | `src/plugins/upload/`         | 上传逻辑                        | 无    |
| auto-complete  | `src/plugins/auto-complete/`  | 自动完成                        | 有    |
