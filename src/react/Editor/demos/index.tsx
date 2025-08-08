import {
  IEditor,
  INSERT_TABLE_COMMAND,
  ReactCodeblockPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactTablePlugin,
} from '@lobehub/editor';
import { Editor, withProps } from '@lobehub/editor/react';
import { Typography } from '@lobehub/ui';
import { useRef } from 'react';

import { INSERT_FILE_COMMAND, ReactFilePlugin } from '@/plugins/file';

import { content } from './data';

function openFileSelector(handleFiles: (files: FileList) => void) {
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

export default () => {
  const editorRef = useRef<IEditor | null>(null);

  return (
    <Typography>
      <Editor
        className="ignore-markdown-style"
        content={content}
        editorRef={editorRef}
        mentionOption={{
          items: [
            {
              label: 'XX',
              value: 'XX',
            },
          ],
          trigger: '@',
        }}
        onChange={(editor) => {
          console.log('Editor content changed:', editor.getDocument('text'));
          console.log('Editor content changed:', editor.getDocument('json'));
        }}
        placeholder={<div>记你想记</div>}
        plugins={[
          ReactListPlugin,
          ReactLinkPlugin,
          ReactImagePlugin,
          ReactCodeblockPlugin,
          ReactHRPlugin,
          ReactTablePlugin,
          withProps(ReactFilePlugin, {
            handleUpload: async (file) => {
              console.log('Files uploaded:', file);
              return new Promise((resolve) => {
                setTimeout(() => {
                  resolve({ url: URL.createObjectURL(file) });
                }, 1000);
              });
            },
          }),
        ]}
        slashOption={{
          items: [
            {
              label: 'Table',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', rows: '3' });
              },
              value: 'table',
            },
            {
              label: 'File',
              onSelect: (editor) => {
                openFileSelector((files) => {
                  for (const file of files) {
                    editor.dispatchCommand(INSERT_FILE_COMMAND, { file });
                  }
                });
              },
              value: 'file',
            },
            {
              label: 'SetTextContent',
              onSelect: () => {
                editorRef.current?.setDocument('text', '123\n123');
                queueMicrotask(() => {
                  editorRef.current?.focus();
                });
              },
              value: 'set-text-content',
            },
          ],
          trigger: '/',
        }}
        style={{
          padding: 24,
        }}
      />
    </Typography>
  );
};
