# Mention Plugin

> **tags**: \[plugin, mention, decorator, DecoratorNode, autocomplete]
> **related_modules**: \[src/plugins/mention, src/plugins/mention/node/MentionNode.ts]

## 定位

`MentionPlugin` 提供 **`@` 提及功能**，插入不可编辑的 DecoratorNode，用于提及用户、AI Agent 等场景。

## 核心文件

| 文件                                               | 类型     | 核心内容                       |
| -------------------------------------------------- | -------- | ------------------------------ |
| `src/plugins/mention/plugin/index.ts`              | 插件类   | `MentionPlugin`                |
| `src/plugins/mention/node/MentionNode.ts`          | 节点     | `MentionNode`（DecoratorNode） |
| `src/plugins/mention/react/ReactMentionPlugin.tsx` | React 层 | 装饰器注册                     |

## MentionNode

```ts
class MentionNode extends DecoratorNode<JSX.Element> {
  __trigger: string; // 触发符，如 "@"
  __value: string; // 实际值，如 "user-id-123"
  __label: string; // 显示文本，如 "张三"
  __rawData: string; // 原始数据 JSON

  static getType(): string {
    return 'mention';
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__value, node.__label, node.__rawData, node.__trigger);
  }

  decorate(editor: LexicalEditor, config: EditorConfig): JSX.Element {
    // 返回 React 组件，由 useDecorators() 渲染为 Portal
  }
}
```

## 序列化格式

```json
{
  "label": "张三",
  "rawData": "{\"id\":\"user-id-123\"}",
  "trigger": "@",
  "type": "mention",
  "value": "user-id-123",
  "version": 1
}
```

## 与 Kernel 的交互

```ts
// MentionPlugin constructor
constructor(kernel, config) {
  super(kernel, config);

  // 注册节点
  kernel.registerNodes([MentionNode]);

  // 注册装饰器（将 MentionNode 映射到 React 组件）
  if (config.decorator) {
    kernel.registerDecorator('mention', config.decorator);
  }

  // 注册 Markdown 读写
  kernel.requireService(MARKDOWN_SHORTCUT_SERVICE)
    ?.registerMarkdownReader('mention', ...)
    ?.registerMarkdownWriter('mention', ...);
}
```

## React 层

```tsx
// ReactMentionPlugin.tsx
const ReactMentionPlugin = ({ items, onSearch, onSelect }) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(MentionPlugin, {
      decorator: (node, editor) => (
        <MentionComponent label={node.getLabel()} ... />
      ),
    });
  }, []);

  return null;
};
```

## 使用场景

- **@用户**：聊天场景中提及其他用户
- **@AI Agent**：触发特定 AI 能力
- **#话题**：可扩展为 `#` 触发的话题标签
