import { ReactEditor, ReactEditorContent, ReactFilePlugin, ReactPlainText } from '@lobehub/editor';

import content from './data.json';

export default () => {
  return (
    <ReactEditor>
      <ReactPlainText>
        <ReactEditorContent content={content} type="json" />
      </ReactPlainText>
      <ReactFilePlugin
        handleUpload={async (file) => {
          console.log('Files uploaded:', file);
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({ url: URL.createObjectURL(file) });
            }, 1000);
          });
        }}
      />
    </ReactEditor>
  );
};
