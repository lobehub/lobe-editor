import { LexicalRenderer } from '@lobehub/editor/renderer';
import type { SerializedEditorState } from 'lexical';

import content from './data.json';

export default () => {
  return <LexicalRenderer value={content as unknown as SerializedEditorState} />;
};
