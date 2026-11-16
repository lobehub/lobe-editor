import { ReactEditor, ReactEditorContent, ReactPlainText, ReactVideoPlugin } from '@lobehub/editor';

import content from './data.json';

const handleUpload = (file: File) =>
  new Promise<{ url: string }>((resolve) => {
    setTimeout(() => resolve({ url: URL.createObjectURL(file) }), 1000);
  });

export default () => {
  return (
    <ReactEditor>
      <ReactPlainText>
        <ReactEditorContent content={content} type="json" />
      </ReactPlainText>
      <ReactVideoPlugin handleUpload={handleUpload} />
    </ReactEditor>
  );
};
