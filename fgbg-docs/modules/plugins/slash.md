# Slash Plugin

> **tags**: \[plugin, slash, command-menu, autocomplete, fuse]
> **related_modules**: \[src/plugins/slash, src/plugins/slash/service/i-slash-service.ts]

## 定位

`SlashPlugin` 提供 **`/` 斜杠命令菜单**，用户输入 `/` 后弹出可搜索的命令列表，支持模糊搜索（基于 Fuse.js）。

## 核心文件

| 文件                                           | 类型     | 核心内容                  |
| ---------------------------------------------- | -------- | ------------------------- |
| `src/plugins/slash/plugin/index.ts`            | 插件类   | `SlashPlugin`             |
| `src/plugins/slash/service/i-slash-service.ts` | 服务     | `SlashService` 接口与实现 |
| `src/plugins/slash/react/ReactSlashPlugin.tsx` | React 层 | 菜单渲染与键盘导航        |

## SlashService

```ts
class SlashService {
  // 注册触发符（默认 '/'，可扩展）
  registerTrigger(trigger: string): void;

  // 注册选项
  registerOption(option: SlashOption): void;

  // 搜索（Fuse.js 模糊匹配）
  search(query: string): SlashOption[];

  // 当前状态
  isOpen(): boolean;
  getQuery(): string;
  getPosition(): DOMRect | null;
}
```

## 触发流程

```
用户输入 "/"
    │
    ▼
registerUpdateListener 检测到触发符
    │
    ▼
SlashPlugin 计算光标位置和搜索词
    │
    ├─ triggerOpen 回调 → React 层显示菜单
    │   → 传递位置信息、当前 query
    │
    └─ 注册键盘监听（↑↓↵Esc）
        → 导航和选择
```

## React 层

```tsx
// ReactSlashPlugin.tsx
const ReactSlashPlugin = ({ options, onSelect }) => {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);

  useEffect(() => {
    editor.registerPlugin(SlashPlugin, {
      triggerOpen: (position, query) => {
        setIsOpen(true);
        setFiltered(fuse.search(query));
      },
      triggerClose: () => setIsOpen(false),
    });
  }, []);

  return isOpen ? <SlashMenu options={filtered} ... /> : null;
};
```

## 键盘导航

| 按键          | 行为         |
| ------------- | ------------ |
| `↑` / `↓`     | 选项上下移动 |
| `↵` / `Enter` | 选中当前选项 |
| `Esc`         | 关闭菜单     |
| 继续输入      | 实时过滤选项 |

## 扩展 Slash 菜单

要添加新的 Slash 命令：

```ts
// 在 React 层传入 options
<ReactSlashPlugin
  options={[
    {
      id: 'my-command',
      label: '我的命令',
      icon: <MyIcon />,
      keywords: ['my', 'command'],
      onSelect: (editor) => {
        editor.update(() => {
          // 插入自定义内容
        });
      },
    },
  ]}
/>
```
