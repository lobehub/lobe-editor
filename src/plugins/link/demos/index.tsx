import { ReactEditor, ReactEditorContent, ReactLinkPlugin, ReactPlainText } from '@/';

import content from './data.json';

export default () => {
  return (
    <ReactEditor>
      <ReactPlainText>
        <ReactEditorContent content={content} type="json" />
      </ReactPlainText>
      <ReactLinkPlugin />
    </ReactEditor>
  );
};
