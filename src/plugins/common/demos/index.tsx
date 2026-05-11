import { ReactEditor, ReactEditorContent, ReactPlainText } from '@/';

import content from './data.json';

export default () => {
  return (
    <ReactEditor>
      <ReactPlainText>
        <ReactEditorContent content={content} placeholder={'placeholder...'} type="json" />
      </ReactPlainText>
    </ReactEditor>
  );
};
