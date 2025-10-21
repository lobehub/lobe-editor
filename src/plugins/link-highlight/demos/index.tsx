import { ReactCodePlugin, ReactEditor, ReactEditorContent, ReactPlainText } from '@lobehub/editor';

import ReactLinkHighlightPlugin from '../react/ReactLinkHighlightPlugin';
import content from './data.json';

export default () => {
  return (
    <ReactEditor>
      <ReactCodePlugin />
      <ReactLinkHighlightPlugin />
      <ReactPlainText>
        <ReactEditorContent content={content} type="json" />
      </ReactPlainText>
    </ReactEditor>
  );
};
