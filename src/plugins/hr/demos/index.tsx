import { ReactEditor, ReactEditorContent, ReactHRPlugin, ReactPlainText } from '@/';

import content from './data.json';

export default () => {
  return (
    <ReactEditor>
      <ReactPlainText>
        <ReactEditorContent content={content} type="json" />
      </ReactPlainText>
      <ReactHRPlugin />
    </ReactEditor>
  );
};
