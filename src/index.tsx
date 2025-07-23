import React, { useEffect, useRef } from 'react';
import Editor, { IEditor } from './editor-kernel';
import { CommonPlugin } from './plugins/common';
import { ISlashService, SlashPlugin } from './plugins/slash';

export interface ILexicalEditorProps {
  className?: string;
  content: any;
  onLoad?: (editor: IEditor) => void;
  style?: React.CSSProperties;
  type: string;
}

export const LexicalEditor: React.FC<ILexicalEditorProps> = (props) => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<IEditor | null>(null);

  useEffect(() => {
    if (editorContainerRef.current) {
      const editor = Editor.createEditor();
      editor
        .registerPlugin(CommonPlugin)
        .registerPlugin(SlashPlugin, {
          name: 'slash'
        });
      editorRef.current = editor;

      editor.setRootElement(editorContainerRef.current);
      editor.setDocument(props.type, props.content);

      editor.requireService(ISlashService)?.registerSlash({
        items: [
          { label: 'Option 1', value: 'option1' },
          { label: 'Option 2', value: 'option2' },
          { label: 'Option 3', value: 'option3' }
        ],
        trigger: '/'
      })

      props.onLoad?.(editor);

      return () => {
        if (editorRef.current) {
          editorRef.current.destroy();
        }
      };
    }
  }, []);

  return <div
    className={props.className}
    contentEditable
    ref={editorContainerRef}
    style={props.style}
  />;
};
