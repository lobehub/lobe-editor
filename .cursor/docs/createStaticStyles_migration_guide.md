# createStaticStyles 使用指南

> 迁移已经完成：`src/` 里已经没有 `createStyles` / `antd-style`，`package.json` 也不再依赖 `antd` / `antd-style`。本文档保留文件名，内容改为当前写法的参考，新代码按这里写。

所有样式工具都从 `@lobehub/ui` 导入（当前 `@lobehub/ui` 6.x，定义在 `@lobehub/ui/es/styles/css.d.mts`）：

| 导出                     | 用途                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `createStaticStyles(fn)` | 模块加载时生成一次类名。`fn` 收到 `{ css, cssVar, cx, responsive }`，返回值原样作为 `styles` 对象 |
| `cssVar`                 | 主题 token 对应的 CSS 变量，值是 `var(--lobe-…)` 字符串（例如 `cssVar.colorText`）                |
| `cx`                     | 合并类名                                                                                          |
| `keyframes`              | 生成动画名，在 `css` 模板里插值使用                                                               |
| `responsive`             | 断点媒体查询（`mobile`、`tablet`、`laptop`、`desktop`、`xs` … `xxl`）                             |
| `useThemeMode()`         | 组件里读取 `{ appearance, isDarkMode }`                                                           |
| `lobeStaticStylish`      | 预置的静态 stylish 片段                                                                           |

## 基本写法

样式文件 `style.ts`：

```typescript
import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  root: css`
    border: 1px solid ${cssVar.colorFillSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    color: ${cssVar.colorText};
  `,
}));
```

组件文件：

```tsx
import { cx } from '@lobehub/ui';
import type { FC } from 'react';

import { styles } from './style';
import type { MyComponentProps } from './type';

const MyComponent: FC<MyComponentProps> = ({ className }) => (
  <div className={cx(styles.root, className)} />
);
```

不再有 `useStyles()` hook，组件里直接用导入的 `styles`。参考 `src/react/ChatInput/style.ts`、`src/react/SendButton/style.ts`。

## 常见场景

### token 值

`cssVar.xxx` 是 `var(--lobe-…)` 形式的 CSS 变量。数值 token 在主题 CSS 里已经输出为 `px`（`lineHeight`、`fontWeightStrong` 等无单位 token 除外），所以不要再拼 `px`，计算用 `calc()`：

```typescript
// ❌
font-size: ${cssVar.fontSize}px;
// ✅
font-size: ${cssVar.fontSize};
margin-block: calc(${cssVar.marginXS} * 2);
```

`cssVar` 不是数字，不能在 JS 里做运算或传给颜色函数。

### 运行时的数值 props → CSS 自定义属性

样式里用带默认值的变量，组件通过 `style` 设置（`src/react/SendButton/`）：

```typescript
// style.ts
button: css`
  width: var(--send-button-size, 32px) !important;
  height: var(--send-button-size, 32px) !important;
`,
```

```tsx
// SendButton.tsx
const cssVariables = useMemo<Record<string, string>>(
  () => ({ '--send-button-size': `${size}px` }),
  [size],
);
// <Button style={{ ...cssVariables, ...style }} ... />
```

### 布尔 / 枚举 props → 拆成多个类名

为每种状态写一个类，在组件里用 `cx` 组合：

```tsx
className={cx(styles.root, variant === 'borderless' && styles.borderless, className)}
```

### 亮色 / 暗色

静态样式拿不到 `isDarkMode`，拆成两个类，在组件里用 `useThemeMode()` 选择（`src/react/ChatInput/ChatInput.tsx`、`src/plugins/litexml/react/DiffNodeToolbar/index.tsx`）：

```tsx
import { cx, useThemeMode } from '@lobehub/ui';

const { isDarkMode } = useThemeMode();

<div className={cx(isDarkMode ? styles.containerDark : styles.containerLight, className)} />;
```

能用 `cssVar` 的颜色 token 自动适配主题时，优先用 token，不要拆类。

### 透明度 / 混色

用 CSS `color-mix()` 代替 JS 颜色计算（`rgba()` 拼 token、`readableColor()` 等）：

```typescript
box-shadow: 0 1px 2px color-mix(in srgb, ${cssVar.colorTextSecondary} 12.5%, transparent);
```

### 动画

```typescript
import { createStaticStyles, keyframes } from '@lobehub/ui';

const cursorBlink = keyframes`
  to {
    visibility: hidden;
  }
`;

export const styles = createStaticStyles(({ css }) => ({
  cursor: css`
    animation: ${cursorBlink} 1.1s steps(2, start) infinite;
  `,
}));
```

参考 `src/plugins/common/react/style.ts`。也可以直接在 `css` 里写 `@keyframes`（`src/plugins/image/react/components/style.ts`）。

### 响应式

```typescript
export const styles = createStaticStyles(({ css, responsive }) => ({
  root: css`
    padding: 16px;

    ${responsive.mobile} {
      padding: 8px;
    }
  `,
}));
```

### 非样式值

`styles` 对象可以混入普通字符串（例如固定的主题类名，见 `src/plugins/common/react/style.ts` 里的 `quote: 'editor_quote'`）。

## 检查清单

- [ ] 从 `@lobehub/ui` 导入 `createStaticStyles` / `cx` / `cssVar` / `keyframes`，不从 `antd-style` 导入
- [ ] 没有 `createStyles` / `useStyles` / `useTheme()` 读 token 拼样式
- [ ] `cssVar` 不加 `px`，计算用 `calc()`
- [ ] 动态值走 CSS 自定义属性，状态走多个类名 + `cx`
- [ ] 暗色差异优先靠 token，必要时用 `useThemeMode()` 选类
- [ ] `pnpm type-check` 和 `pnpm lint:style` 通过
