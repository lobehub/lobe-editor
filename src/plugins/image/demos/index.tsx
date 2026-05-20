import {
  type IEditor,
  ReactEditor,
  ReactEditorContent,
  ReactImagePlugin,
  ReactPlainText,
} from '@lobehub/editor';
import { useMemo, useState } from 'react';

import content from './data.json';

type DemoContent = typeof content;

interface SerializedBlockImage {
  maxWidth?: number;
  type: 'block-image';
  width?: number;
}

function findBlockImage(node: unknown): SerializedBlockImage | null {
  if (!node || typeof node !== 'object') return null;

  const value = node as { children?: unknown; maxWidth?: unknown; type?: unknown; width?: unknown };
  if (value.type === 'block-image') {
    return {
      maxWidth: typeof value.maxWidth === 'number' ? value.maxWidth : undefined,
      type: 'block-image',
      width: typeof value.width === 'number' ? value.width : undefined,
    };
  }

  if (!Array.isArray(value.children)) return null;

  for (const child of value.children) {
    const image = findBlockImage(child);
    if (image) return image;
  }

  return null;
}

export default () => {
  const [editorContent, setEditorContent] = useState<DemoContent>(content);
  const [snapshot, setSnapshot] = useState<DemoContent>(content);
  const [revision, setRevision] = useState(0);

  const blockImage = useMemo(() => findBlockImage(snapshot.root), [snapshot]);

  const handleChange = (editor: IEditor) => {
    const nextSnapshot = editor.getDocument('json');
    if (nextSnapshot) setSnapshot(nextSnapshot as unknown as DemoContent);
  };

  const handleHydrateSnapshot = () => {
    setEditorContent(snapshot);
    setRevision((value) => value + 1);
  };

  return (
    <ReactEditor key={revision}>
      <ReactPlainText onChange={handleChange}>
        <ReactEditorContent content={editorContent} type="json" />
      </ReactPlainText>
      <ReactImagePlugin />
      <div style={{ marginTop: 16 }}>
        <button onClick={handleHydrateSnapshot} type="button">
          Hydrate from current JSON
        </button>
        <pre style={{ marginTop: 8 }}>
          {JSON.stringify(
            {
              blockImageMaxWidth: blockImage?.maxWidth,
              blockImageWidth: blockImage?.width,
            },
            null,
            2,
          )}
        </pre>
      </div>
    </ReactEditor>
  );
};
