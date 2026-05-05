# Editor Kernel

> **tags**: \[kernel, editor-kernel, lexical, IEditor, IEditorKernel, lifecycle]
> **related_modules**: \[src/editor-kernel, src/types/kernel.ts, src/types/locale.ts]

## 定位

`src/editor-kernel/` 是项目的**编辑器引擎层**，是对 Lexical 原生的上层封装与编排。它通过 `Kernel` 类将 Lexical 的底层 API 包装为面向插件和业务的高阶抽象，同时提供 React 绑定、数据源管理、服务注入、热重载等企业级编辑器基础设施。

## 核心文件

| 文件                               | 类型   | 行数  | 核心内容                                         |
| ---------------------------------- | ------ | ----- | ------------------------------------------------ |
| `src/editor-kernel/kernel.ts`      | 类     | \~892 | `Kernel` 类，实现 `IEditorKernel`                |
| `src/editor-kernel/plugin.ts`      | 抽象类 | \~60  | `KernelPlugin`，插件基类                         |
| `src/editor-kernel/data-source.ts` | 抽象类 | \~30  | `DataSource`，数据源基类                         |
| `src/editor-kernel/event.ts`       | 模块   | \~50  | `HOVER_COMMAND` 自定义 Command                   |
| `src/editor-kernel/utils.ts`       | 工具   | \~200 | DOM / 节点映射、Kernel 注册表、装饰器 reconciler |
| `src/editor-kernel/index.ts`       | 入口   | \~20  | `Editor` 工厂对象                                |

## Kernel 类详解

### 创建方式

```ts
// 方式 1: 工厂对象（推荐）
import Editor from '@/editor-kernel';
// 方式 2: 直接 new（内部使用）
import { Kernel } from '@/editor-kernel/kernel';

const editor = Editor.createEditor();

const kernel = new Kernel(config);
```

### 核心属性

```ts
class Kernel implements IEditorKernel {
  private lexicalEditor: LexicalEditor; // 内部持有的 Lexical 实例
  private plugins: Map<string, IEditorPlugin>; // 已注册插件实例
  private nodes: LexicalNodeConstructor[]; // 收集的节点类
  private decorators: Map<string, IDecorator>; // 装饰器注册表
  private dataSources: Map<string, DataSource>; // 数据源注册表
  private services: Map<IServiceID, any>; // 服务 DI 容器
  private themes: Record<string, any>; // CSS 类名主题映射
  private locale: Record<string, string>; // 国际化字典
}
```

### 生命周期方法

| 方法                      | 职责                        | 调用时机            |
| ------------------------- | --------------------------- | ------------------- |
| `initNodeEditor()`        | 初始化浏览器端编辑器        | 需要 DOM 时         |
| `initHeadlessEditor()`    | 初始化 Headless 编辑器      | SSR/Node 环境       |
| `setRootElement(element)` | 挂载到 DOM                  | React 组件 mount 后 |
| `destroy()`               | 清理所有插件、listener、DOM | 组件 unmount 时     |

### 插件管理

```ts
// 注册单个插件
kernel.registerPlugin(SlashPlugin, { trigger: '/' });

// 批量注册
kernel.registerPlugins([
  [CommonPlugin, { enableHistory: true }],
  MarkdownPlugin,
  [SlashPlugin, { trigger: '/' }],
]);
```

**热重载支持**：开发模式下自动检测 Webpack/Vite/Next.js HMR，支持插件 / 装饰器 / 服务的运行时替换。

### 服务注入（DI）

```ts
// 注册服务
kernel.registerService(MARKDOWN_SHORTCUT_SERVICE, new MarkdownShortCutService());

// 消费服务（类型安全）
const service = kernel.requireService(MARKDOWN_SHORTCUT_SERVICE);
```

**关键服务 ID**：

- `MARKDOWN_SHORTCUT_SERVICE` (`src/plugins/markdown/service/shortcut.ts`) — Markdown 转换中枢
- `SLASH_SERVICE` (`src/plugins/slash/service/i-slash-service.ts`) — Slash 搜索服务
- `ILINK_SERVICE` — 链接管理服务

### 装饰器管理

```ts
// 注册装饰器（将 Lexical Node 映射到 React 组件）
kernel.registerDecorator('mention', (node, editor) => <MentionComponent ... />);

// 获取装饰器
const decorator = kernel.getDecorator('mention');
```

装饰器通过 `useDecorators()` Hook 转换为 React Portal 数组，渲染到 `PortalContainer` 中。

### 选区操作

```ts
// 设置选区（支持三种类型）
kernel.setSelection({
  type: 'range', // 'range' | 'node' | 'table'
  startNodeId: 'node-key',
  endNodeId: 'node-key',
  startOffset: 0,
  endOffset: 5,
});

// 获取序列化选区
const selection = kernel.getSelection();
```

### 命令系统

```ts
// 分发命令（透传到 Lexical）
kernel.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');

// 注册高优先级命令（自定义优先级 listener 体系）
kernel.registerHighCommand(
  KEY_ENTER_COMMAND,
  (event) => {
    /* 处理逻辑 */ return true;
  },
  COMMAND_PRIORITY_HIGH,
);
```

## KernelPlugin 基类

```ts
export abstract class KernelPlugin extends EventEmitter {
  protected clears: Array<() => void> = []; // 副作用清理函数列表
  protected registeredDecorators: Set<string> = new Set();

  // 注册清理函数（destroy 时自动执行）
  protected register(clear: () => void): void;

  // 注册装饰器（自动追踪，便于热重载清理）
  protected registerDecorator(kernel, name, decorator): void;

  // 销毁时统一清理
  public destroy(): void {
    this.clears.forEach((clear) => clear());
    this.clears = [];
  }

  // 生命周期钩子
  abstract onInit?(editor: LexicalEditor): void;
}
```

**所有插件必须**：

1. 继承 `KernelPlugin`
2. 定义 `static pluginName: string` 作为唯一标识
3. 在 `constructor` 中注册 Node、Theme、Service、Decorator
4. 在 `onInit` 中注册 Command、Listener
5. 所有副作用通过 `register()` 记录，确保 `destroy()` 时清理

## DataSource 基类

```ts
export abstract class DataSource {
  // 类型标识，用于匹配 kernel.setDocument(type, data)
  abstract readonly type: string;

  // 将外部数据转换为 Lexical EditorState
  abstract read(editor: LexicalEditor, data: any, options?: Record<string, unknown>): void;

  // 将 Lexical EditorState 转换为外部数据
  abstract write(editor: LexicalEditor, options?: IWriteOptions): any;
}
```

## React 集成子模块

### 文件清单

| 文件                                               | 类型    | 核心内容                                               |
| -------------------------------------------------- | ------- | ------------------------------------------------------ |
| `src/editor-kernel/react/react-context.ts`         | Context | `LexicalComposerContext` / `useLexicalComposerContext` |
| `src/editor-kernel/react/react-editor.tsx`         | 组件    | `ReactEditor` 初始化组件                               |
| `src/editor-kernel/react/useDecorators.tsx`        | Hook    | 装饰器 → React Portal 转换                             |
| `src/editor-kernel/react/useAnchor.ts`             | Hook    | Portal 挂载点查询                                      |
| `src/editor-kernel/react/PortalAnchor.tsx`         | 组件    | 基于 Anchor 的 Portal                                  |
| `src/editor-kernel/react/PortalContainer.tsx`      | 组件    | `LexicalPortalContainer`（DOM key 绑定）               |
| `src/editor-kernel/react/LexicalErrorBoundary.tsx` | 组件    | 装饰器错误边界                                         |

### 关键 Hook: useLexicalComposerContext

```ts
const [editor] = useLexicalComposerContext(); // 返回 IEditor 实例（即 Kernel）
```

这是 React 层获取编辑器内核的唯一入口。所有 React 插件组件都通过此 Hook 访问 Kernel。

### Decorator → Portal 渲染流程

```
Lexical Node（如 MentionNode）
    │
    ▼
Lexical 触发 decorator 更新
    │
    ▼
Kernel.getDecorator(node.getType()) → 获取 React 组件工厂
    │
    ▼
useDecorators() Hook → 生成 React Portal 数组
    │
    ▼
PortalContainer 渲染到 createPortal(rootElement, ...)
    │
    ▼
DOM 中显示自定义节点 UI（如 @用户名）
```

## inode 子模块

`src/editor-kernel/inode/` 是对 **Lexical 序列化节点类型** 的薄层封装，用于在插件和数据源中便捷地构造 / 操作序列化 JSON 结构。

```ts
// 核心类型
export type INode = SerializedLexicalNode;
export type IElementNode = SerializedElementNode;
export type ITextNode = SerializedTextNode;

// 工厂对象
export const INodeHelper = {
  createElementNode(type, props),
  createTextNode(text, format?),
  createParagraph(children?),
  createRootNode(children?),
  appendChild(parent, child),
  isParagraphNode(node),
  isTextNode(node),
};
```

**注意**：`inode` 操作的是**序列化 JSON 对象**，不是运行时的 Lexical Node 实例。在 Lexical `editor.update()` 中应使用 `$` 系列 API 操作节点。

## 与 Lexical 的关系

### 封装 vs 扩展

| 维度       | 行为        | 说明                                                        |
| ---------- | ----------- | ----------------------------------------------------------- |
| 编辑器实例 | 封装        | Kernel 内部调用 `createEditor()` / `createHeadlessEditor()` |
| 命令系统   | 扩展        | `registerHighCommand()` 自建多优先级 listener 管理          |
| 节点注册   | 封装        | Kernel 收集所有节点配置后统一传入 Lexical                   |
| 装饰器     | 扩展        | Lexical 原生 decorator + 自定义 `queryDOM` + React Portal   |
| 数据源     | 扩展        | Lexical 无原生数据源概念，完全自建                          |
| 服务注册   | 扩展        | 基于 `IServiceID` 的 DI 容器，完全自建                      |
| 热重载     | 扩展        | 检测 HMR，支持运行时替换                                    |
| React 集成 | 封装 / 适配 | 参考 `@lexical/react` 设计，适配到 `IEditor` 层             |
| 选区       | 封装        | 将 Lexical 三种选区统一序列化为 `ISelectionObject`          |

### 关键注入点

```ts
// Kernel 创建 LexicalEditor 时注入自身
createEditor({
  // @ts-expect-error
  __kernel: this,
  nodes: this.nodes,
  theme: this.themes,
  ...
});

// 反向获取
const kernel = getKernelFromEditor(lexicalEditor); // 读取 __kernel 属性
```

## 调试技巧

- Kernel 内部使用 `debugLogger`（`src/utils/debug.ts`）输出调试信息
- 浏览器控制台执行：`localStorage.debug = 'lobe-editor:kernel*'` 开启 Kernel 调试日志
- Kernel 事件：`kernel.on('documentChange', cb)`, `kernel.on('error', cb)`
