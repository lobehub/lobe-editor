import { LexicalRenderer } from '@lobehub/editor/renderer';
import type { SerializedEditorState } from 'lexical';

import content from './data.json';

export default () => {
  return (
    <LexicalRenderer
      style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.6, maxWidth: 720, padding: 24 }}
      value={content as unknown as SerializedEditorState}
    />
  );
};
