import {
  ReactCodeblockPlugin,
  ReactEditor,
  ReactEditorContent,
  ReactPlainText,
} from '@/';

import content from './data.json';

export default () => {
  return (
    <ReactEditor>
      <ReactPlainText>
        <ReactEditorContent content={content} type="json" />
      </ReactPlainText>
      <ReactCodeblockPlugin />
    </ReactEditor>
  );
};
