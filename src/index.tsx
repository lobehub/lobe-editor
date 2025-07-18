import React, { useEffect, useRef } from 'react';
import Editor, { IEditor } from './api-core';
import CommonPlugin from './api-core/common';


export interface ILexicalEditorProps {
  type: string;
  content: any;
  onLoad?: (editor: IEditor) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const LexicalEditor: React.FC<ILexicalEditorProps> = (props) => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<IEditor | null>(null);

  useEffect(() => {
    if (editorContainerRef.current) {
      const editor = Editor.createEditor();
      editor.registerPlugins(CommonPlugin);
      editorRef.current = editor;

      editor.setRootElement(editorContainerRef.current);
      editor.setDocument(props.type, props.content);

      props.onLoad?.(editor);

      return () => {
        if (editorRef.current) {
          editorRef.current.destroy();
        }
      };
    }
  }, []);

  return <div
    ref={editorContainerRef}
    contentEditable
    className={props.className}
    style={props.style}
  />;
};
