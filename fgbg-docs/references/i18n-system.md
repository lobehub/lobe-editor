# 国际化（i18n）系统

> **tags**: \[reference, i18n, locale, translation, zh-CN, en-US, useTranslation, TFunction]
> **purpose**: 完整记录编辑器的国际化架构 —— locale 文件结构、注册机制、翻译函数使用方式、插件级 locale 扩展、以及如何新增翻译键。

## 关键文件

| 文件                                        | 职责                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/locale/index.ts`                       | en-US 默认 locale 对象 + `enUS` 导出 + 转发 `zhCN`                                            |
| `src/locale/zh-CN.ts`                       | zh-CN locale 对象（与 en-US 键结构完全一致）                                                  |
| `src/types/locale.ts`                       | 类型定义：`LocaleType`、`TFunction`、`ILocaleKeys`（从 locale 对象自动推导）                  |
| `src/editor-kernel/kernel.ts`               | `Kernel` 类：`localeMap` 存储、`t()` 翻译方法（lodash template）、`registerLocale()` 合并注册 |
| `src/editor-kernel/react/useTranslation.ts` | `useTranslation()` hook：返回 `TFunction`                                                     |
| `src/react/hooks/useEditorLocale/index.ts`  | `useEditorLocale()` hook：额外暴露 `setLocale()`                                              |
| `src/editor-kernel/react/react-editor.tsx`  | `ConfigInjector`：将 `config.locale` 注入编辑器                                               |
| `src/react/EditorProvider/index.tsx`        | 全局 `<EditorProvider>`：提供 `locale` / `theme` 配置                                         |

## 架构总览

```
┌─────────────────────────────────────────────────┐
│                  EditorProvider                  │
│  config={{ locale: { myKey: '值' } }}           │
└──────────────────┬──────────────────────────────┘
                   │ context
                   ▼
┌─────────────────────────────────────────────────┐
│              ConfigInjector                      │
│  editor.registerLocale(config.locale)            │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│            Kernel.localeMap                      │
│  { 'bgColor': 'Background Color',                │
│    'codemirror.selectLanguage': '...',           │
│    'markdown.pasteTitle': '...',                 │
│    ... }                                         │
│                                                  │
│  t(key, params?) → string                       │
│    └─ lodash template('{{param}}')               │
└──────────────────┬──────────────────────────────┘
                   │
      ┌────────────┴────────────┐
      ▼                         ▼
 useTranslation()          useEditorLocale()
 → TFunction               → { t, setLocale }
```

## Locale 文件结构

### en-US（默认）

```typescript
// src/locale/index.ts
const locale = {
  bgColor: 'Background Color', // 扁平键
  cancel: 'Cancel',
  confirm: 'Confirm',
  codemirror: {
    // 嵌套组
    copyFailed: 'Copy failed',
    selectLanguage: 'Select language',
    // ...
  },
  markdown: {
    autoFormatTitle: 'Markdown Converted',
    pasteTitle: 'Markdown Format Detected',
    pasteDescription: 'Pasted content appears to be Markdown. Convert to rich text?',
    pasteConfirm: 'Convert',
    pasteCancel: 'Keep Plain Text',
    // ...
  },
};

export default locale;
export const enUS = locale;
export { zhCN } from './zh-CN';
```

### zh-CN

```typescript
// src/locale/zh-CN.ts
const zhCN = {
  bgColor: '背景颜色',
  cancel: '取消',
  confirm: '确认',
  codemirror: {
    copyFailed: '复制失败',
    selectLanguage: '选择语言',
    // ...
  },
  markdown: {
    autoFormatTitle: 'Markdown 已转换',
    pasteTitle: '检测到 Markdown 格式',
    pasteDescription: '粘贴的内容似乎是 Markdown 格式，是否转换为富文本？',
    pasteConfirm: '转换',
    pasteCancel: '保留纯文本',
    // ...
  },
};
```

**关键约定**：

- 两个文件的键结构**完全一致**，类型从 en-US 自动推导
- 键名使用**点分隔**的嵌套路径：`'markdown.pasteTitle'`
- 支持 `{{param}}` 参数插值：`'file.error': 'Error: {{message}}'`

## 翻译函数 `t()`

```typescript
// 类型定义（自动推导）
type TFunction = <K extends keyof ILocaleKeys>(key: K, options?: Record<string, any>) => string;
```

**使用示例**：

```typescript
const t = useTranslation();

// 简单键
t('confirm'); // → "Confirm" / "确认"

// 嵌套键（点分隔）
t('codemirror.selectLanguage'); // → "Select language" / "选择语言"

// 参数插值
t('file.error', { message: 'timeout' }); // → "Error: timeout"
```

**实现原理**（`kernel.ts:773`）：

```typescript
t(key, options?) {
  const template = this.localeMap[key];
  if (!template) return key;  // fallback to key itself
  if (!options) return template;
  return lodashTemplate(template)(options);  // lodash template 引擎
}
```

## 两种注册方式

### 方式 1：初始化时注册（全局）

```tsx
// 通过 EditorProvider
<EditorProvider config={{ locale: { myKey: 'My Value' } }}>
  <Editor />
</EditorProvider>;

// 或通过 useEditorLocale 运行时切换
const { setLocale } = useEditorLocale();
setLocale(zhCN); // 替换整个 locale map
```

### 方式 2：插件注册（局部）

```tsx
// 插件 React 组件中
const MyPluginReact: FC = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.registerLocale({
      myPlugin: {
        title: 'My Plugin',
        action: 'Do something',
      },
    });
  }, [editor]);

  return null;
};
```

**`registerLocale` vs `setLocale`**：

- `registerLocale(locale)` — **合并**到现有 locale map，适合插件注册
- `setLocale(locale)` — **替换**整个 locale map，适合运行时语言切换

## 如何新增翻译键

1. **在 `src/locale/index.ts`** 添加英文键（可嵌套）：

   ```typescript
   const locale = {
     // ...existing keys
     myFeature: {
       title: 'My Feature',
       description: 'This is {{name}}',
     },
   };
   ```

2. **在 `src/locale/zh-CN.ts`** 添加中文翻译（键结构必须一致）：

   ```typescript
   const zhCN = {
     // ...existing keys
     myFeature: {
       title: '我的功能',
       description: '这是 {{name}}',
     },
   };
   ```

3. **在组件中使用**：

   ```typescript
   const t = useTranslation();
   t('myFeature.title');
   t('myFeature.description', { name: 'cool' });
   ```

4. **类型自动更新**：`ILocaleKeys` 从 `typeof import('@/locale').default` 推导，新增键后 TypeScript 自动补全。

## 获取 locale 的 Hooks

### `useTranslation()`

```typescript
// src/editor-kernel/react/useTranslation.ts
import { useTranslation } from '@/editor-kernel/react/useTranslation';

function MyComponent() {
  const t = useTranslation();
  return <span>{t('confirm')}</span>;
}

// 别名（向后兼容）
const useLocale = useTranslation;
```

### `useEditorLocale()`

```typescript
// src/react/hooks/useEditorLocale/index.ts
import { useEditorLocale } from '@/react/hooks/useEditorLocale';

function MyComponent() {
  const { t, setLocale } = useEditorLocale();

  // 翻译
  t('confirm');

  // 运行时切换语言
  const switchToChinese = () => setLocale(zhCN);
  const switchToEnglish = () => setLocale(enUS);
}
```

## 语言切换时机

```typescript
// 多处可以触发切换：

// 1. 初始化时通过 EditorProvider
<EditorProvider config={{ locale: zhCN }}>

// 2. 运行时通过 useEditorLocale
const { setLocale } = useEditorLocale();
setLocale(zhCN);

// 3. 每个 editor 实例也可独立设置
editor.setLocale(zhCN);
```

切换后所有使用 `useTranslation()` 的组件自动重渲染（`useCallback` 依赖 `editor`，locale 变化触发 context 更新）。

## 设计决策

### 为什么用 lodash template 而非 i18next？

- 零依赖：lodash template 已在项目中使用
- 简单够用：编辑器只支持 `{{param}}` 插值，不需要复数 / 性别 / 上下文等复杂特性
- 类型安全：`TFunction` 的 key 参数从 `ILocaleKeys` 类型推导，编译期检查

### 为什么键结构用嵌套对象 + 点分隔？

- 嵌套对象：编写时直观分组，避免键名冲突
- 点分隔访问：`t('markdown.pasteTitle')` 比 `t('markdown').pasteTitle` 更灵活
- 扁平化存储：kernel 内部 `localeMap` 是 `Record<string, string>`，点分隔键直接 O (1) 查找

### 为什么两个 locale 文件独立导出？

- 按需加载：调用方可以只导入需要的语言（`import { zhCN } from '@lobehub/editor'`）
- 类型推导：TypeScript 从 en-US 推导类型，zh-CN 只需值匹配
- 扩展性：未来增加语言只需新增文件，不改现有代码

## 现有 Locale 键全览

| 分组         | 键数 | 用途                                        |
| ------------ | ---- | ------------------------------------------- |
| 顶层         | 3    | `bgColor`, `textColor`, `cancel`, `confirm` |
| `codemirror` | 9    | 代码块：复制、语言选择、主题、行号等        |
| `file`       | 2    | 文件上传：错误、上传中                      |
| `image`      | 2    | 图片：加载失败、替换                        |
| `link`       | 6    | 链接：编辑、打开、取消链接、占位符          |
| `markdown`   | 10   | Markdown：自动转换提示、解析确认、粘贴确认  |
| `math`       | 1    | 数学公式：占位符                            |
| `meta2d`     | \~60 | 流程图编辑器：工具栏、组件面板、属性面板    |
| `modifier`   | 4    | AI 修改：接受 / 拒绝                        |
| `table`      | 6    | 表格：删除、插入行列                        |

总计约 100+ 个键，未来新增插件可按 `registerLocale()` 模式扩展。
