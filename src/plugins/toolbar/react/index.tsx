import { mergeRegister } from '@lexical/utils';
import { Block } from '@lobehub/ui';
import {
  $getSelection,
  COMMAND_PRIORITY_LOW,
  LexicalEditor,
  SELECTION_CHANGE_COMMAND,
  getDOMSelection,
} from 'lexical';
import { FC, useCallback, useRef } from 'react';

import { useLexicalComposerContext, useLexicalEditor } from '@/editor-kernel/react';
import { ILinkService } from '@/plugins/link';
import { createDebugLogger } from '@/utils/debug';

import { HIDE_TOOLBAR_COMMAND, registerToolbarCommand } from '../command';
import { getDOMRangeRect } from '../utils/getDOMRangeRect';
import { setFloatingElemPosition } from '../utils/setFloatingElemPosition';
import { useStyles } from './style';
import { ReactToolbarPluginProps } from './type';

export const ReactToolbarPlugin: FC<ReactToolbarPluginProps> = ({ className, children }) => {
  const popupCharStylesEditorRef = useRef<HTMLDivElement | null>(null);
  const anchorElemRef = useRef<HTMLDivElement | null>(null);
  const [kernelEditor] = useLexicalComposerContext();
  const { cx, styles } = useStyles();
  const isMouseDownRef = useRef(false);
  const logger = createDebugLogger('plugin', 'toolbar');

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

        logger.debug('🔍 rangeRect', rangeRect);

        setFloatingElemPosition(rangeRect, popupCharStylesEditorElem, anchorElemRef.current, false);
      } else {
        popupCharStylesEditorElem.style.opacity = '0';
        popupCharStylesEditorElem.style.transform = 'translate(-10000px, -10000px)';
      }
    },
    [anchorElemRef],
  );

  const $hideFloatingToolbar = useCallback(() => {
    if (!anchorElemRef.current) {
      return;
    }

    const popupCharStylesEditorElem = popupCharStylesEditorRef.current;

    if (popupCharStylesEditorElem === null) {
      return;
    }

    popupCharStylesEditorElem.style.opacity = '0';
    popupCharStylesEditorElem.style.transform = 'translate(-10000px, -10000px)';
  }, [anchorElemRef]);

  const handleMouseDownFactory = useCallback(
    (updateToolbar: () => void) => (e: MouseEvent) => {
      if (e.button === 0) {
        // 0 is left mouse button
        isMouseDownRef.current = true;
        // Update toolbar when mouse is released
        updateToolbar();
      }
    },
    [],
  );

  const handleMouseUpFactory = useCallback(
    (updateToolbar: () => void) => (e: MouseEvent) => {
      if (e.button === 0) {
        // 0 is left mouse button
        isMouseDownRef.current = false;
        // Update toolbar when mouse is released
        updateToolbar();
      }
    },
    [],
  );

  useLexicalEditor(() => {
    const service = kernelEditor.requireService(ILinkService);
    if (service) {
      service.setLinkToolbar(false);
      return () => {
        service.setLinkToolbar(true);
      };
    }
  }, []);

  useLexicalEditor((editor) => {
    const handleMouseDown = handleMouseDownFactory(() => {
      editor.dispatchCommand(HIDE_TOOLBAR_COMMAND, undefined);
    });
    const handleMouseUp = handleMouseUpFactory(() => {
      editor.update(() => {
        $updateTextFormatFloatingToolbar(editor);
      });
    });

    const rootElement = editor.getRootElement();
    if (rootElement) {
      rootElement.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return mergeRegister(
      registerToolbarCommand(editor, {
        onHide: $hideFloatingToolbar,
      }),

      editor.registerUpdateListener(({ editorState }) => {
        // Only update when mouse is not pressed
        if (!isMouseDownRef.current) {
          editorState.read(() => {
            $updateTextFormatFloatingToolbar(editor);
          });
        }
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          // Only update when mouse is not pressed
          if (!isMouseDownRef.current) {
            $updateTextFormatFloatingToolbar(editor);
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),

      () => {
        if (rootElement) {
          rootElement.removeEventListener('mousedown', handleMouseDown);
          document.removeEventListener('mouseup', handleMouseUp);
        }
      },
    );
  });

  return (
    <div ref={anchorElemRef} style={{ position: 'relative' }}>
      <Block
        className={cx(styles, className)}
        padding={4}
        ref={popupCharStylesEditorRef}
        variant={'outlined'}
      >
        {children}
      </Block>
    </div>
  );
};
