import { mergeRegister } from '@lexical/utils';
import {
  $getSelection,
  COMMAND_PRIORITY_LOW,
  LexicalEditor,
  SELECTION_CHANGE_COMMAND,
  getDOMSelection,
} from 'lexical';
import { FC, useCallback, useRef } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';

import { getDOMRangeRect } from '../utils/getDOMRangeRect';
import { setFloatingElemPosition } from '../utils/setFloatingElemPosition';
import { useStyles } from './style';
import { ReactToolbarPluginProps } from './type';

export const ReactToolbarPlugin: FC<ReactToolbarPluginProps> = ({ className, children }) => {
  const popupCharStylesEditorRef = useRef<HTMLDivElement | null>(null);
  const anchorElemRef = useRef<HTMLDivElement | null>(null);
  const { cx, styles } = useStyles();

  const $updateTextFormatFloatingToolbar = useCallback(
    (editor: LexicalEditor) => {
      if (!anchorElemRef.current) {
        return;
      }
      const selection = $getSelection();

      const popupCharStylesEditorElem = popupCharStylesEditorRef.current;
      const nativeSelection = getDOMSelection(editor._window);

      if (popupCharStylesEditorElem === null) {
        return;
      }

      const rootElement = editor.getRootElement();
      if (
        selection !== null &&
        nativeSelection !== null &&
        !nativeSelection.isCollapsed &&
        rootElement !== null &&
        rootElement.contains(nativeSelection.anchorNode)
      ) {
        const rangeRect = getDOMRangeRect(nativeSelection, rootElement);

        setFloatingElemPosition(rangeRect, popupCharStylesEditorElem, anchorElemRef.current, false);
      } else {
        popupCharStylesEditorElem.style.opacity = '0';
        popupCharStylesEditorElem.style.transform = 'translate(-10000px, -10000px)';
      }
    },
    [anchorElemRef],
  );

  useLexicalEditor((editor) => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          $updateTextFormatFloatingToolbar(editor);
        });
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          $updateTextFormatFloatingToolbar(editor);
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  });

  return (
    <div ref={anchorElemRef} style={{ position: 'relative' }}>
      <div className={cx(styles, className)} ref={popupCharStylesEditorRef}>
        {children}
      </div>
    </div>
  );
};
