export function openFileSelector(handleFiles: (files: FileList) => void) {
  // 创建一个隐藏的 input 元素
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '*/*'; // 接受所有文件类型
  input.multiple = false; // 是否允许多选

  // 监听文件选择事件
  // eslint-disable-next-line unicorn/prefer-add-event-listener
  input.onchange = (event) => {
    // @ts-expect-error not error
    const files = event.target?.files;
    if (files && files.length > 0) {
      console.log('Selected files:', files);
      // 处理选中的文件
      handleFiles(files);
    }
  };

  // 触发文件选择器
  input.click();
}
