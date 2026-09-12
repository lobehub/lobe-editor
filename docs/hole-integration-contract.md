# Hole 接入契约与共享行为矩阵

本文把 `HoleNode` 当作编辑器运行时的结构边界来描述。它不是一个可持久化的内容类型，也不是某个卡片插件的私有包装。插件只声明哪些块需要边界，并在自己的内容确实可编辑时接管进入动作；Common 统一负责包装、边界游标、结构导航、输入转移和运行时投影。

## 接入的最小契约

一个插件要接入 Hole，需要在 `onInit` 中取得 `IHoleService`，注册一个非 inline 的 Lexical 节点构造器，并保存 `registerTarget` 返回的清理函数，在插件销毁时调用它（通常交给 `this.register(...)` 管理）。`registerTarget` 可以早于 `HoleService.bindEditor` 调用：服务先记录目标，首次 bind 时再为所有预注册目标安装 transform；如果 editor 已绑定，则立即安装。首次 bind 会保留 bind 前注册的订阅，替换活跃 editor 或 dispose 时清理旧 editor 的 listeners。服务也支持在传入文档规范化前调用 `normalizeIncoming()`。接口和目标文本序列化回调见 [i-hole-service.ts](../src/plugins/common/service/i-hole-service.ts)，实际注册、绑定和清理见 [hole.ts](../src/plugins/common/service/hole.ts)。

以 HRPlugin 为例，最小接入和清理就是：

```ts
const holeService = this.kernel.requireService(IHoleService);
if (holeService) this.register(holeService.registerTarget(HorizontalRuleNode));
```

完整上下文见 [HRPlugin](../src/plugins/hr/plugin/index.ts)。

注册表只匹配已注册的构造器（或序列化类型）、非 inline 节点；`HoleNode`、`CursorNode`，以及已经直接位于 Hole 下的节点永远不会再次包装。遍历仍会进入复合 Hole 的后代，所以复合 payload 内部可以拥有自己的独立 Hole。这个边界由 [hole-normalization.ts](../src/plugins/common/node/hole-normalization.ts) 定义。

包装发生在当前 Lexical transaction 内，由 Common 决定结构位置：

- 直接位于非 paragraph 容器中的目标，替换原位置为 `[before cursor, target, after cursor]` Hole。
- paragraph 中间的目标会把前后兄弟拆成 `paragraph → Hole → paragraph`，并复制 paragraph 的 format、indent、direction。
- paragraph 开头或结尾的目标会成为相邻 Hole；空 paragraph 会被移除。
- 目标的 Lexical key 仍归 payload 所有；Hole key 只是本次运行时结构 key。

因此插件不应自己制造一套游标包装算法，也不应把普通 paragraph、heading、list 或 quote 声明为 Hole target。[hole-normalization.test.ts](../src/plugins/common/node/hole-normalization.test.ts) 覆盖 paragraph 拆分、格式保留、quote/list/table-cell 容器中的嵌套位置、inline、未注册节点、guard 和幂等行为。

Hole 的直接子节点形状是 `[before cursor, content..., after cursor]`。`getContentChildren()` 只返回 payload，不把游标当作内容；多 payload 是合法形状，顺序和每个 payload 的 key 都必须保留。包装器不应从目标的内部编辑模型推断内容；内部 editor、表格 cell 或装饰器的首尾位置由目标自己决定。

## 目标矩阵

下表中的“headless 进入”只表示 Common + 节点插件、没有 React/DOM renderer 时，边界向内容内部移动的结果。`reject` 并不禁止该目标在浏览器 renderer 注册后接受进入；它表示 Common 不会替原子目标伪造内部 caret，命令没有 handler 时回到另一侧 Hole 边界。

| 目标                      | 注册插件           | headless 进入                | 进入 owner / 内容职责                                                                                            | 现有专项证据                                                                                                                                                                                                                          |
| ------------------------- | ------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `horizontalrule`          | `HRPlugin`         | reject                       | 原子装饰块；HR 自己提供 Markdown/LiteXML                                                                         | [HR Hole test](../src/plugins/hr/__tests__/hole.test.ts)                                                                                                                                                                              |
| `block-file`              | `FilePlugin`       | reject                       | 原子上传块；文件名由注册时的 `serializeTextContent` 提供                                                         | [BlockFile Hole test](../src/plugins/file/__tests__/hole.test.ts)                                                                                                                                                                     |
| `mathBlock`               | `MathPlugin`       | reject                       | 块级数学装饰器；inline `math` 留在 paragraph 内                                                                  | [MathBlock Hole test](../src/plugins/math/__tests__/hole.test.ts)                                                                                                                                                                     |
| `link-block-card`         | `LinkPlugin`       | reject                       | 块预览卡；title 由 link 插件的 serializer 提供                                                                   | [link Hole test](../src/plugins/link/__test__/hole.test.ts)                                                                                                                                                                           |
| `link-iframe`             | `LinkPlugin`       | reject                       | 块级 iframe 预览；title 由 link 插件的 serializer 提供                                                           | [link Hole test](../src/plugins/link/__test__/hole.test.ts)                                                                                                                                                                           |
| `artifact`                | `ArtifactPlugin`   | reject（无 renderer 时）     | Artifact React view 在可编辑且 key 匹配时接收 `ENTER_HOLE_CONTENT_COMMAND`，自己 focus 并设置 code/textarea 首尾 | [ArtifactView](../src/plugins/artifact/react/ArtifactView.tsx)、[ArtifactView test](../src/plugins/artifact/react/ArtifactView.test.tsx)                                                                                              |
| `block-image`             | `ImagePlugin`      | reject                       | 原子图片块；图片内部控件通过自己的 DOM 标记保持交互                                                              | [BlockImage Hole regression](../src/plugins/image/__test__/block-image-hole-regression.test.ts)                                                                                                                                       |
| `table`                   | `TablePlugin`      | accept                       | TablePlugin 计算首 cell/末 cell，由 cell 选择首尾；表格结构不进入 Common                                         | [table plugin](../src/plugins/table/plugin/index.ts)、[table Hole navigation](../src/plugins/table/__test__/hole-navigation.test.ts)                                                                                                  |
| `code` (`CodeNode`)       | `CodeblockPlugin`  | accept                       | Codeblock plugin 找到首/末 descendant，选择其 text edge                                                          | [hole-entry.ts](../src/plugins/codeblock/command/hole-entry.ts)、[CodeNode Hole navigation](../src/plugins/codeblock/__tests__/hole-navigation.test.ts)                                                                               |
| `code` (`CodeMirrorNode`) | `CodemirrorPlugin` | reject（无 React editor 时） | CodeMirror React view 在可编辑、未远端锁定时 focus 外部实例并自己设首尾；该 handler 不属于 Common                | [CodemirrorPlugin](../src/plugins/codemirror-block/plugin/index.ts)、[CodemirrorNode](../src/plugins/codemirror-block/react/CodemirrorNode.tsx)、[CodemirrorNode test](../src/plugins/codemirror-block/react/CodemirrorNode.test.tsx) |

共享参数化回归位于 [hole-contract.test.ts](../src/plugins/common/node/hole-contract.test.ts)：它覆盖上表的 HR、block-file、mathBlock、两个 link block、artifact、image、table、CodeNode 和 CodeMirrorNode。该测试验证每个 target 的 Hole 形状、JSON 投影、↑/↓邻接和两侧进入，也验证普通 paragraph/heading/list/quote 不包、collapsible 容器/title 不包，而其内部独立的 BlockImage 可以包。它只检查公共契约，不重复插件的上传、渲染、交换或协作场景。

## 导航与输入

Common 只处理结构边界：

1. 在 Hole 的 `before` 或 `after` 边界按 `ArrowUp`，选择同一结构范围内前一个 block 的末端；在 `before` 或 `after` 边界按 `ArrowDown`，选择后一个 block 的开头。
2. 相邻 Hole 是真实停靠点。连续卡片必须逐个停靠，不能把一串 Hole 直接跳到后面的 paragraph。
3. `before + ArrowLeft` 和 `after + ArrowRight` 向外离开；如果方向没有 sibling，Common 才创建外部 paragraph。反向进入只 dispatch 通用命令，不直接碰 payload 的内部 selection。
4. `ENTER_HOLE_CONTENT_COMMAND` 的 canonical payload 是 `{ from: 'before' | 'after', key }`；`edge: 'start' | 'end'` 只为旧调用方保留。解析函数见 [common command](../src/plugins/common/command/index.ts)。Common controller 只在 `before + Right` 或 `after + Left` 时 dispatch，并且只有 handler 返回 `true` 才把焦点交给 target；否则选择相反的 Hole cursor，见 [hole-controller.ts](../src/plugins/common/node/hole-controller.ts)。
5. 接受进入的 target 必须证明自己真正拥有 caret/focus：Lexical target 选择自己的内容子树首/尾，外部 editor focus 自己的实例并清掉 stale outer selection。不能只返回 `true` 而留下 Hole boundary selection。

箭头事件先经过 `shouldHandleNavigationEvent`：已经 `defaultPrevented`、IME composing、editor composing、readonly、Alt/Ctrl/Meta 修改键都交回原 owner。对 Hole 来说，plain vertical 的 Shift 事件交给正常 selection owner；horizontal Hole range expansion 才显式允许 Shift。因此普通 paragraph 的 Shift+Enter 不属于 Hole 契约；对应回归在 [hole-enter.test.ts](../src/plugins/common/node/hole-enter.test.ts)，modifier/readonly/IME 保护在 [hole-navigation.test.ts](../src/plugins/common/node/hole-navigation.test.ts) 中，Shift range 行为也在同一导航测试中覆盖。

竖向搜索以 root 或 shadow root 为边界，不能从 table cell、collapsible body 等局部结构穿到外层。普通 Hole 的连续停靠和 table-cell 局部交接见 [hole-navigation.test.ts](../src/plugins/common/node/hole-navigation.test.ts)；[navigation.ts](../src/plugins/common/node/navigation.ts) 是结构 walk，[hole-controller.ts](../src/plugins/common/node/hole-controller.ts) 负责 Hole/ShadowRoot 的垂直选择目标。

## 选择、复制和多 payload

完整 NodeSelection 或跨越两个 Hole cursor 的 RangeSelection 覆盖整个 Hole；只覆盖 payload 内部的 descendant selection 必须留给目标 editor。Common 的 `$readHoleSelectionCoverage` 和 atomic selection helper 不应把任意 descendant 强行升级为整卡选择。CodeNode 的 partial selection、Enter/Undo 和 CodeMirror 的内部更新见 [hole-block-targets.test.ts](../src/plugins/common/node/hole-block-targets.test.ts)。

一个 Hole 可以有多个 payload。对只操作单个 payload 的复制、转换成 inline link 或拆出操作，必须保留其余 payload 的 document order、Hole shell、Lexical key、durable node ID 和 annotation；整 Hole 的删除或剪切则应删除整个 Hole 及其全部 payload。Link 的 multi-payload 参数化回归和 block preview logical ID swap 见 [link Hole test](../src/plugins/link/__test__/hole.test.ts)。

Lexical key 是运行时地址，不是持久 ID。可寻址 block 的 durable `nodeId` 属于 payload；Hole/Cursor 本身不应成为可寻址 block。JSON projection 会把 Hole wrapper 的 `$` metadata 合并到 projected payload，避免 annotation 因丢弃 wrapper 而孤儿化，见 [hole-serialization.ts](../src/plugins/common/node/hole-serialization.ts)。Properties、协作和 link conversion 不得把 structural Hole key 当作 logical target ID。

## JSON、Markdown 与 renderer 边界

Common 在 JSON writer 中递归去掉运行时 Hole 和其 cursor，并保留/合并 payload；因此持久化 JSON 不应出现 `"type":"hole"`。Common Markdown writer 同样只遍历非 cursor 的 payload child，见 [CommonPlugin](../src/plugins/common/plugin/index.ts)。但这只保证 wrapper 透明，不保证每个 node 的 Markdown 表示无损：语言别名、表格空 cell、装饰器 fallback、外部编辑器状态和插件私有 metadata 仍由各插件 writer 决定，必要时可以降级。Code、HR、math、file、artifact 的具体 Markdown 断言见 [hole-block-targets.test.ts](../src/plugins/common/node/hole-block-targets.test.ts)、[HR Hole test](../src/plugins/hr/__tests__/hole.test.ts)、[MathBlock Hole test](../src/plugins/math/__tests__/hole.test.ts)、[BlockFile Hole test](../src/plugins/file/__tests__/hole.test.ts) 和 [Artifact test](../src/plugins/artifact/__tests__/artifact.test.ts)。

Common 负责 `HoleNode` 的 DOM host、`data-hole-content` slot、边界 hit area 和可复用的稳定 wrapper；`HoleNode.updateDOM(): false` 让外层 wrapper DOM 得以复用，Lexical 再单独 reconcile content slot。目标插件负责自己的 DOM/decorator、内部 editor、上传/锁、目标特有 Markdown/LiteXML 和 `ENTER_HOLE_CONTENT_COMMAND` handler。renderer 只把 Hole 作为透明结构输出：[render-builtin-node.tsx](../src/renderer/engine/render-builtin-node.tsx) 的 `hole` 分支返回 children，[renderer/nodes/index.ts](../src/renderer/nodes/index.ts) 注册 Hole 和目标 node；renderer 不拥有 target registration、导航或持久化策略。

## 共享回归的适用边界

`hole-contract.test.ts` 是唯一的通用 target matrix；插件专项测试仍负责以下不可抽象部分：

- Artifact/CodeMirror 的实际 React focus、textarea/CodeMirror 首尾、锁和 DOM 生命周期；
- Image 的 intrinsic layout、控件 pointer routing、IME 文本和协作迁移；
- Table 的 cell map、selection、scroll/geometry 和 shadow-root owner；
- Link 的 block/inline conversion、multi-payload swap、logical ID 和 title clipboard；
- File upload settle、Math inline/block parser、HR/Code/Markdown/LiteXML writer。

新增 target 时先补矩阵中的注册、Hole shape、JSON projection、两侧导航和 headless entry 期望，再在插件目录补自己的 renderer/serialization/interaction 测试。若插件需要可编辑内部 editor，必须同时提供 before/right 与 after/left 两个方向的真实首尾断言；若只是原子块，返回 `false` 让 Common 保持边界语义，不要在 Common 中猜内部 caret。
