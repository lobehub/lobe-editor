import {
  IEditor,
  INSERT_FILE_COMMAND,
  INSERT_IMAGE_COMMAND,
  useToolbarState,
} from '@lobehub/editor';
import { Button } from '@lobehub/ui';
import { RefObject } from 'react';

import { openFileSelector } from './actions';

export interface IToolbarProps {
  editorRef: RefObject<IEditor | null>;
}

export default function Toolbar({ editorRef }: IToolbarProps) {
  const toolbarState = useToolbarState(editorRef);

  return (
    <div>
      <Button disabled={!toolbarState.canRedo} onClick={toolbarState.redo}>
        Redo
      </Button>
      <Button disabled={!toolbarState.canUndo} onClick={toolbarState.undo}>
        Undo
      </Button>
      <Button onClick={toolbarState.bold} type={toolbarState.isBold ? 'primary' : 'default'}>
        B
      </Button>
      <Button onClick={toolbarState.italic} type={toolbarState.isItalic ? 'primary' : 'default'}>
        I
      </Button>
      <Button
        onClick={toolbarState.underline}
        type={toolbarState.isUnderline ? 'primary' : 'default'}
      >
        U
      </Button>
      <Button
        onClick={toolbarState.strikethrough}
        style={{
          textDecoration: 'line-through',
        }}
        type={toolbarState.isStrikethrough ? 'primary' : 'default'}
      >
        S
      </Button>
      <Button onClick={toolbarState.code} type={toolbarState.isCode ? 'primary' : 'default'}>
        C
      </Button>
      <Button
        onClick={() => {
          openFileSelector((files) => {
            for (const file of files) {
              editorRef.current?.dispatchCommand(INSERT_IMAGE_COMMAND, { file });
            }
          }, 'image/*');
        }}
      >
        Image
      </Button>
      <Button
        onClick={() => {
          openFileSelector((files) => {
            for (const file of files) {
              editorRef.current?.dispatchCommand(INSERT_FILE_COMMAND, { file });
            }
          });
        }}
      >
        File
      </Button>
    </div>
  );
}
