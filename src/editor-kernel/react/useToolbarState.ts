import { mergeRegister } from '@lexical/utils';
import {
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  LexicalEditor,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  TextFormatType,
  UNDO_COMMAND,
} from 'lexical';
import { RefObject, useCallback, useEffect, useState } from 'react';

import { IEditor } from '../types';

/**
 * 提供 toolbar 状态，和 toolbar 方法
 * @returns
 */
export function useToolbarState(editorRef: RefObject<IEditor | null>) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsCode(selection.hasFormat('code'));
    }
  }, []);

  const undo = useCallback(() => {
    editorRef.current?.dispatchCommand(UNDO_COMMAND, undefined);
  }, [editorRef.current]);

  const redo = useCallback(() => {
    editorRef.current?.dispatchCommand(REDO_COMMAND, undefined);
  }, [editorRef.current]);

  const formatText = useCallback(
    (type: TextFormatType) => {
      editorRef.current?.dispatchCommand(FORMAT_TEXT_COMMAND, type);
    },
    [editorRef.current],
  );

  const bold = useCallback(() => {
    formatText('bold');
  }, [formatText]);

  const underline = useCallback(() => {
    formatText('underline');
  }, [formatText]);

  const strikethrough = useCallback(() => {
    formatText('strikethrough');
  }, [formatText]);

  const italic = useCallback(() => {
    formatText('italic');
  }, [formatText]);

  const code = useCallback(() => {
    formatText('code');
  }, [formatText]);

  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const lexicalEditor = editor.getLexicalEditor();
    let cleanup: () => void = () => {};
    const handleLeixcalEditor = (editor: LexicalEditor) => {
      cleanup = mergeRegister(
        editor.registerUpdateListener(({ editorState }) => {
          editorState.read(() => {
            $updateToolbar();
          });
        }),
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            $updateToolbar();
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          CAN_UNDO_COMMAND,
          (payload) => {
            setCanUndo(payload);
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          CAN_REDO_COMMAND,
          (payload) => {
            setCanRedo(payload);
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
      );
      return cleanup;
    };
    if (!lexicalEditor) {
      editor.on('initialized', handleLeixcalEditor);
      return () => {
        cleanup();
        editor.off('initialized', handleLeixcalEditor);
      };
    }
    return handleLeixcalEditor(lexicalEditor);
  }, [editorRef.current]);

  return {
    bold,
    canRedo,
    canUndo,
    code,
    isBold,
    isCode,
    isItalic,
    isStrikethrough,
    isUnderline,
    italic,
    redo,
    strikethrough,
    underline,
    undo,
  };
}
