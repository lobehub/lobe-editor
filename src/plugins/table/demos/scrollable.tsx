import { ReactEditor, ReactEditorContent, ReactPlainText, ReactTablePlugin } from '@lobehub/editor';

import content from './scrollable.json';

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
