import { ReactEditor, ReactEditorContent, ReactListPlugin, ReactPlainText } from '@/';

import content from './data.json';

export default () => {
  return (
    <ReactEditor>
      <ReactPlainText>
        <ReactEditorContent content={content} type="json" />
      </ReactPlainText>
      <ReactListPlugin />
    </ReactEditor>
  );
};
