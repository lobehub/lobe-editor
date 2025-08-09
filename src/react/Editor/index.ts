import type { ReactNode } from 'react';

import EditorParent from './Editor';
import type { EditorProps } from './type';
import { useEditor } from './useEditor';
import { withProps } from './utils';

interface IEditor {
  (props: EditorProps): ReactNode;
  useEditor: typeof useEditor;
  withProps: typeof withProps;
}

const Editor = EditorParent as unknown as IEditor;
Editor.useEditor = useEditor;
Editor.withProps = withProps;

export default Editor;
export * from './type';
export { useEditor } from './useEditor';
export * from './utils';
