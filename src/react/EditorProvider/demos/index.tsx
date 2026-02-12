import { EditorProvider } from '@lobehub/editor/react';

import Editor from '@/react/Editor/demos';

// Custom locale package
const customLocale = {
  file: {
    error: '错误：{{message}}',
    uploading: '正在上传文件...',
  },
  image: {
    broken: '图片损坏',
    replace: '替换',
  },
  link: {
    edit: '编辑链接',
    editLinkTitle: '链接',
    editTextTitle: '文本',
    open: '打开链接',
    placeholder: '输入链接 URL',
    unlink: '取消链接',
  },
  table: {
    delete: '删除表格',
    deleteColumn: '删除列',
    deleteRow: '删除行',
    insertColumnLeft: '在左侧插入 {{count}} 列',
    insertColumnRight: '在右侧插入 {{count}} 列',
    insertRowAbove: '在上方插入 {{count}} 行',
    insertRowBelow: '在下方插入 {{count}} 行',
  },
};

export default function BasicDemo() {
  return (
    <EditorProvider config={{ locale: customLocale }}>
      <Editor />
    </EditorProvider>
  );
}
