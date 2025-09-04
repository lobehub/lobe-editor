import type { ReactNode } from 'react';

import { useEditor } from '../hooks/useEditor';
import { useEditorState } from '../hooks/useEditorState';
import EditorParent from './Editor';
import type { EditorProps } from './type';
import { withProps } from './utils';

interface IEditor {
  (props: EditorProps): ReactNode;
  useEditor: typeof useEditor;
  useEditorState: typeof useEditorState;
  withProps: typeof withProps;
}

const Editor = EditorParent as unknown as IEditor;
Editor.useEditor = useEditor;
Editor.useEditorState = useEditorState;
Editor.withProps = withProps;

export default Editor;

export * from './type';
export * from './utils';
