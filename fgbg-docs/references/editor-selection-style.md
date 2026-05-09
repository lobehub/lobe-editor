# 编辑器选区（Selection）样式配置

## 问题背景
编辑器默认的选区（划词）高亮样式有两个问题：
1. 颜色是系统默认黄色，与产品视觉风格不匹配
2. 选区内的文字颜色会被统一覆盖（红色变黑色），无法保留原文本颜色

## 解决方案

### 1. 修改位置
文件路径：`src/plugins/common/react/style.ts`

在 `editorContent` 样式块中添加 `::selection` 伪元素样式：

```typescript
const editorContent = css`
  flex: 1;
  min-height: 0;
  outline: none;

  &::selection,
  *::selection {
    color: currentcolor;
    background-color: rgba(64, 169, 255, 18%);
    -webkit-text-fill-color: currentcolor;
  }

  @media (prefers-color-scheme: dark) {
    &::selection,
    *::selection {
      color: currentcolor;
      background-color: rgba(145, 213, 255, 12%);
      -webkit-text-fill-color: currentcolor;
    }
  }
`;
```

### 2. 关键技术点

#### currentColor vs inherit
- ❌ `color: inherit`：会继承外层编辑器的默认文字颜色，导致选区内彩色文字（如红色、蓝色）变成黑色
- ✅ `color: currentColor`：使用当前文本节点自身的颜色，保留原文字的颜色

#### -webkit-text-fill-color
某些浏览器（尤其是 Safari）会用 `-webkit-text-fill-color` 覆盖 `color` 属性，需要同时设置才能确保文字颜色不被覆盖。

#### 明暗主题适配
- **浅色模式**：使用 `rgba(64, 169, 255, 18%)` - 稍微明显的蓝色，避免在浅色背景下太浅看不见
- **深色模式**：使用 `rgba(145, 213, 255, 12%)` - 更浅、更透明，避免在深色背景下太深压制文字颜色

### 3. 为什么要加在 editorContent 而不是 root？
`editorContent` 对应的是真正的 `contenteditable` 节点，也是所有文本节点的直接父容器。`::selection` 样式需要作用在这个节点及其子节点上，而不是外层的 root div，否则可能被浏览器默认样式或全局样式覆盖。

## 相关提交
- Commit: `style: optimize editor selection color, support dark/light theme and preserve original text color`
- 分支: `cursor/fix-useEditorState-getStyle-match`

## 调试提示
如果后续修改选区样式不生效，可以用浏览器 DevTools 检查：
1. 选中编辑器内的文字
2. 在 Elements 面板中搜索 `::selection`
3. 确认样式来源是否正确
4. 检查是否有全局样式的 `::selection` 覆盖了编辑器样式
