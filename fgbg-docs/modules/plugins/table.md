# Table Plugin

> **tags**: \[plugin, table, lexical-table, DOM, headless-compatible]
> **related_modules**: \[src/plugins/table, src/plugins/table/node/index.ts]

## 定位

`TablePlugin` 提供**表格编辑**，基于 `@lexical/table`。支持表格创建、单元格编辑、行列操作、列宽拖拽。

## 核心文件

| 文件                                            | 类型   | 核心内容            |
| ----------------------------------------------- | ------ | ------------------- |
| `src/plugins/table/plugin/index.ts`             | 插件类 | `TablePlugin`       |
| `src/plugins/table/node/index.ts`               | 节点   | `TableNode` + patch |
| `src/plugins/table/react/TableActionMenu.tsx`   | React  | 右键 / 按钮操作菜单 |
| `src/plugins/table/react/TableHoverActions.tsx` | React  | 悬浮操作按钮        |
| `src/plugins/table/react/TableResize.tsx`       | React  | 列宽拖拽调整        |

## 节点类型

```ts
// 注册的 Lexical 节点
[TableNode, TableRowNode, TableCellNode];
```

`TableNode` 经过 `patchTableNode` 处理，修复了某些 Lexical 原生行为。

## Headless 兼容

```ts
onInit(editor: LexicalEditor): void {
  if (!isHeadlessEditor(editor)) {
    // 仅在有 DOM 环境时注册
    this.register(registerTablePlugin(editor));
    this.register(registerTableSelectionObserver(editor));
  }

  // Markdown 读写始终注册
  this.registerMarkdownSupport();
}
```

## Markdown 支持

支持 GFM 表格格式：

```markdown
| 表头1   | 表头2   |
| ------- | ------- |
| 单元格1 | 单元格2 |
```

## React UI

| 组件                | 功能                                    |
| ------------------- | --------------------------------------- |
| `TableActionMenu`   | 右键菜单：插入 / 删除行列、合并单元格等 |
| `TableHoverActions` | 悬浮显示行列操作按钮                    |
| `TableResize`       | 列宽拖拽调整                            |

## 与 Lexical 的关系

直接使用 `@lexical/table` 提供的：

- `registerTablePlugin` — 表格核心功能
- `registerTableSelectionObserver` — 表格选区观察
- `TableNode`, `TableRowNode`, `TableCellNode` — 节点定义

本项目主要做：

1. 集成到 Kernel 插件体系
2. 添加 Markdown 读写支持
3. 提供 React UI 层
4. Headless 环境适配
