import { ReactEditor, ReactEditorContent, ReactPlainText, ReactTablePlugin } from '@/';

import content from './data.json';

export default () => {
  return (
    <ReactEditor>
      <ReactPlainText>
        <ReactEditorContent content={content} type="json" />
      </ReactPlainText>
      <ReactTablePlugin />
    </ReactEditor>
  );
};
