import { EditorProvider } from '@lobehub/editor/react';

import Editor from '@/react/Editor/demos';

// Custom locale package
const customLocale = {
  file: {
    download: '下载',
    error: '错误：{{message}}',
    preview: '预览',
    uploading: '正在上传文件...',
  },
  image: {
    broken: '图片损坏',
    captionPlaceholder: '添加图片说明',
    preview: '预览图片',
    replace: '替换',
  },
  link: {
    copy: '复制链接',
    copySuccess: '链接已复制',
    convertToCard: '转为卡片',
    convertToIframe: '转为嵌入',
    convertToLink: '转为链接',
    convertToSchema: '转为协议组件',
    edit: '编辑链接',
    editLinkTitle: '链接',
    editTextTitle: '文本',
    open: '打开链接',
    placeholder: '输入链接 URL',
    unlink: '取消链接',
  },
  table: {
    align: '对齐',
    alignCenter: '居中对齐',
    alignLeft: '左对齐',
    alignRight: '右对齐',
    autoFitWidth: '自动适配',
    columnWidth: '列宽',
    delete: '删除表格',
    deleteColumn: '删除列',
    deleteColumns: '删除 {{count}} 列',
    deleteRow: '删除行',
    deleteRows: '删除 {{count}} 行',
    distributeWidth: '平均分配',
    gripColumn: '第 {{index}} 列',
    gripRow: '第 {{index}} 行',
    gripTable: '表格',
    insertColumn: '插入列',
    insertColumnLeft: '在左侧插入列',
    insertColumnRight: '在右侧插入列',
    insertRow: '插入行',
    insertRowAbove: '在上方插入行',
    insertRowBelow: '在下方插入行',
    syncWidth: '同步到所有列',
  },
};

export default function BasicDemo() {
  return (
    <EditorProvider config={{ locale: customLocale }}>
      <Editor />
    </EditorProvider>
  );
}
