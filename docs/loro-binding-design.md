# Loro / Lexical binding contract

本文描述当前实现的可用契约。Loro 是宿主为新文档选择的协同引擎；SDK 不替宿主决定 Page 的 backend。已有文档和显式选择 Yjs 的入口继续使用 Yjs。backend、room 和持久化格式由宿主元数据决定，不能从 provider 形状猜测。

## 公共 descriptor

中立 collaboration contract 的 snapshot、anchor、causal version、persistence proof，以及 `lobe-collaboration-v2` 的 room envelope 使用 descriptor。原生 Loro/Yjs update bytes 不改写，依赖绑定的 engine/schema context。既有 `lobe-yjs-v1` 同步路径继续保留；新版认证消息可携带 descriptor。`lexical-yjs-v1/v2` 是 binding schema，不是 transport protocol。descriptor 结构如下：

```ts
type CollaborationDescriptor = {
  engine: 'yjs' | 'loro';
  bindingSchema: 'lexical-yjs-v1' | 'lexical-yjs-v2' | 'lexical-loro-v1';
  epoch: number; // non-negative safe integer
};
```

合法组合由 [protocol.ts](../src/common/collaboration/protocol.ts) 校验：`yjs` 只能配两个 Yjs schema，`loro` 只能配 `lexical-loro-v1`。descriptor 不包含 roomId；room envelope 必须独立校验 room/document namespace。descriptor 不匹配时拒绝 import、anchor 或 persistence proof。

Loro 文档的 meta map 使用实际实现中的 `schemaVersion: 'lexical-loro-v1'`、`bindingSchema` 和 `epoch`。Loro tree 名称为 `lobe:lexical:v1`，meta 名称为 `lobe:lexical:meta`。这些常量和字段由 [model.ts](../src/plugins/loro/model.ts) 定义。

## 入口和 factory

Loro 是显式 opt-in 入口：

```ts
import { LoroPlugin, createLoroBindingDescriptor } from '@lobehub/editor/loro';
import { LoroReactPlugin } from '@lobehub/editor/loro/react';
import { createLoroHeadlessFactory } from '@lobehub/editor/loro/headless';
```

`@lobehub/editor/loro/headless` 提供 `createLoroHeadlessFactory()`。`CollaborativeAgentEditor.create` 使用 Loro 时必须显式注入该 factory；旧 Yjs 调用不需要 factory。browser/headless consumer 负责按自己的 WASM bundler 配置加载 `loro-crdt@1.16.1`。

`tsdown` 让 headless 和 browser entry 使用 unbundle 共享模块；`propertiesState`、Lexical runtime 和 command symbols 不能各自复制。packed integration 必须同时加载 root 与 headless entry，并验证 `propertiesState`/editor identity 以及一次真实 Loro anchor capture。

核心调用边界是 `LoroCanonicalDocument`（创建、`fromSnapshot`、增量 `import`、snapshot/update export）、`LoroLexicalBinding`（Lexical projection 与 readiness）和 `createLoroHeadlessBinding`（DOM-free 同一 binding）。transport 只能把已包 descriptor 的 update 交给 binding 的 `applyUpdate`；不得直接调用外部 `LoroDoc.import`。

## canonical model

Lexical EditorState、JSON、HTML 和 Markdown 都是投影。协同源是 Loro 的细粒度 containers：

```text
tree: LoroTree                 // 结构和 sibling order
node.data.type: string
node.data.role: node role
node.data.properties: mergeable LoroMap
node.data.attrs: mergeable LoroMap
node.data.flow: mergeable LoroText       // text-flow owner
node.data.body: mergeable LoroText       // Artifact/CodeMirror source
```

`properties` 和 `attrs` 的 key 独立写入；删除字段使用 map.delete。顶层字段是并发粒度，字段值本身可以是标量或一个 adapter 声明的原子值；普通 `options` 对象不会自动递归成多个 CRDT fields。正文、HTML source、CodeMirror source 必须进入 LoroText，不能整段 text 或整篇 JSON LWW 覆盖。

block 的业务身份是 `properties.nodeId`，不使用 Lexical NodeKey、路径、数组 index 或 peer/counter。Loro TreeID/ContainerID 是 CRDT 内部身份；TextNode 没有独立 durable nodeId。Tree sibling order 来自 `tree.roots()` 或 parent.children()，不是全量 nodes 枚举顺序。

Hole 和 Cursor 是 runtime projection。Hole payload 的逻辑节点必须进入 canonical tree，Hole/Cursor wrapper 本身不能进入 CRDT。未知 custom node 没有 capability 时明确拒绝；不能默认 exportJSON 为 opaque blob。

## text-flow 和 capability

一个 flow owner 对应一个 LoroText。Lexical TextNode split/merge、格式 leaf 和 inline wrapper 都是这个 flow 的投影，不创建每 leaf 一个 LoroText。marks 使用固定 schema key；inline link、mention、math、image、file、LinkCard 等 adapter 通过 durable inline identity 和 mark/sentinel 保存身份。Unicode offsets 使用 UTF-16，diff 不能切开 surrogate pair。

节点 capability 明确 type、role、合法 parent、attrs、flow/body policy 和 Lexical factory。当前真实 headless registry 覆盖 paragraph、heading、quote、list、table、HR、Artifact、CodeMirror、block image/file/math、link card/iframe、collapsible、diff，以及 inline link/autolink/schema/mention/math/image/file/code 等已注册节点，清单见 [capabilities.ts](../src/plugins/loro/capabilities.ts)。

`link-card` 是真实的 inline `DecoratorNode`，按 `atom` capability 保存为带 durable identity 和属性的 inline record，不能把它当作普通 TextNode 或依据 `getTextContent()` 写回 flow。`codeInline` 的 Cursor child 是 runtime marker，跳过后仍保留代码边界。未知 custom node 没有 capability 时拒绝整批写入；不会默默降级成 opaque JSON。

Properties 协同复用中立的 `PropertiesCollaborationProvider` port（`attachAnnotationStorage`、node identity、readiness、subscribe），实现见 [properties-provider.ts](../src/plugins/loro/properties-provider.ts)。annotation storage 与正文 history 分离；TextNode 上需要持久化的 properties 仍按字段/范围语义保存，不能用一个整对象 LWW 覆盖其他 peer 的字段。

## 首次 snapshot、重连和写入门槛

`shouldBootstrap:false` 且 canonical 为空时，binding 处于 `initializing`，editorData 只作显示缓存：Lexical update、body、annotation 和其他 `runLocalTransaction` 写入都会被阻断。宿主收到并校验首次权威 snapshot 后，通过受控 `applyUpdate` 导入；只有有效的首次 `applyUpdate` 通过校验并完成投影，binding 才接受 snapshot、将文档视为已同步并进入 `ready`。空 snapshot 可以沿同一有效导入路径接受；不能从“当前为空”猜测它是否权威。

首次 snapshot 强制校验 descriptor/schema/epoch、capability、duplicate nodeId、合法 parent 和 flow inline references。失败保持不可写。重连后的已接受文档不重新走首次 gate，未确认的本地变更由 transport 的 causal update 继续处理。

未信任的 room candidate 只在 admission/首次 snapshot 使用隔离 probe（`trusted:false`）；descriptor 已由 envelope 校验的热路径使用增量 import（`trusted:true`），不为每个按键隐式复制整份历史 snapshot。candidate 校验通过后，后续导入仍必须经过 binding 的 phase 和 descriptor 检查。

所有 remote import 必须经过 binding 的受控入口。入口在 import 前 flush 已排队的本地 Lexical transaction、捕获 selection，在 Loro subscriber 同步触发的 projection transaction 内完成结构/attrs/flow/body 更新。raw `doc.import` 会使 binding incompatible，不能悄悄继续让旧 Lexical state 覆盖 canonical。

## selection、history 和原子 projection

selection wire 使用 descriptor-bound Loro Cursor、flow owner nodeId 和 Hole side；不使用 NodeKey。remote projection 在同一次 Lexical update 中先完成内容，再在同一闭包内恢复 Cursor selection 或合法化当前 Range offset。仍然合法的 Hole boundary 和 NodeSelection 必须保留；Range 则在同一事务内恢复或合法化，不因无法转成 text Cursor 而清空有效选择。

Loro history adapter 注册 CRITICAL `UNDO_COMMAND`/`REDO_COMMAND`，空栈也消费，避免 Lexical HistoryPlugin fallback。CAN\_UNDO/CAN\_REDO 随 stack、editable 和 dispose 状态更新。HISTORY\_PUSH/MERGE 和结构 shape 变化形成明确 transaction boundary；连续普通输入保持 merge interval，显式 HISTORY\_MERGE 可放宽分组。

每个 Loro stack item 由 `UndoManager.onPush/onPop` 保存 before/after selection 与 Cursor\[]。onPop 晚于 canonical event 时只累计 dirty projection，待 undo/redo 返回后再投影；恢复 selection 不使用整篇 snapshot 或旧数值 offset。相关实现见 [binding.ts](../src/plugins/loro/binding.ts) 和 [history.ts](../src/plugins/loro/history.ts)。

投影、import、history 回调和 readiness 发布都必须以已提交的 Lexical update 为边界；监听器在同一次 update 里只能看到合法节点和 offset。unsupported node、缺失 durable identity、descriptor 不兼容或 commit callback 失败时，binding 进入明确的 `incompatible`/错误路径，未完成的 pending operations 不得作为已发布文档继续使用。`dispose` 取消 CRDT、Lexical、annotation 和 readiness 监听，旧 storage 引用不可再写入。

## Yjs 与 Loro 的 history 差异

Yjs 继续使用 [Yjs history adapter](../src/plugins/yjs/plugin/utils/history.ts) 的 `createForeignChangeDeleteFilter`：本地 stack item 创建的结构子树若包含 foreign change，本次 Undo 消费该受保护条目但不改文档；后续 Undo 调用可以继续消费更早的条目。human origin、空栈消费和 Lexical history boundary 保持现有行为。

Loro 1.16.1 的 native UndoManager 没有 Yjs 等价的 deleteFilter、skip 或 stack reorder；onPop 在 inverse 已应用后触发。当前 Loro binding 使用 native structural Undo：撤销本地创建块可以移除块及其后续远端内容；Map 同字段和 rich-text mark 也遵循 native inverse，可能回到本地旧值。两引擎不宣称 foreign Undo 完全一致，不用快照补偿、清空 history 或静默改写 remote 内容掩盖差异。独立 API/repro 结论由锁定版本专项测试维护，不属于 Yjs 旧文档迁移。

## 验收边界

必须覆盖真实 headless registry、双 peer、snapshot reload、跨父 move、Hole payload、mixed block order、Unicode/marks、inline identity、首次 snapshot gate、reconnect、annotation lifecycle、Undo/redo selection 和 packed root+headless entry。实现测试位于 `src/plugins/loro/__tests__`、`src/headless/__tests__` 和 `src/common/collaboration/transport`。

服务端按 descriptor 转发并持久化相应 engine 的 snapshot/update；它不把 Lexical JSON 变成协同源，也不把 Yjs 当 Loro backend。旧 Yjs room、snapshot、annotation 和 provider 继续走旧协议。迁移是另一个显式任务，不在打开旧文档时隐式执行。
