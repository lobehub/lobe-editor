import React, { useEffect, useRef } from 'react';
import ApiCore, { IEditor } from './api-core';
import CommonPlugin from './api-core/common';


export interface ILexicalEditorProps {
  type: string;
  content: any;
  onLoad?: (editor: IEditor) => void;
}

export const LexicalEditor: React.FC<ILexicalEditorProps> = (props) => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<IEditor | null>(null);

  useEffect(() => {
    if (editorContainerRef.current) {
      const editor = ApiCore.createEditor();
      editor.registerPlugin(CommonPlugin);
      editorRef.current = editor;

      editor.setRootElement(editorContainerRef.current);
      editor.setDocument(props.type, props.content);

      props.onLoad?.(editor);

      return () => {
        if (editorRef.current) {
          (editorRef.current as any).destroy();
        }
      };
    }
  }, []);

  return <div ref={editorContainerRef} contentEditable style={{ border: '1px solid #ccc', padding: '10px' }} />;
};
