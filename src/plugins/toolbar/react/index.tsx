import { mergeRegister } from '@lexical/utils';
import { Block } from '@lobehub/ui';
import { cx, useThemeMode } from 'antd-style';
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
import { LinkService } from '@/plugins/link/service/i-link-service';
import { createDebugLogger } from '@/utils/debug';

import { HIDE_TOOLBAR_COMMAND, registerToolbarCommand } from '../command';
import { getDOMRangeRect } from '../utils/getDOMRangeRect';
import { setFloatingElemPosition } from '../utils/setFloatingElemPosition';
import { styles } from './style';
import { ReactToolbarPluginProps } from './type';

export const ReactToolbarPlugin: FC<ReactToolbarPluginProps> = ({ className, children }) => {
  const popupCharStylesEditorRef = useRef<HTMLDivElement | null>(null);
  const anchorElemRef = useRef<HTMLDivElement | null>(null);
  const [kernelEditor] = useLexicalComposerContext();
  const { isDarkMode } = useThemeMode();
  const isMouseDownRef = useRef(false);
  const linkToolbarSuppressionTokenRef = useRef<symbol | null>(null);
  const logger = createDebugLogger('plugin', 'toolbar');

  const getLinkService = useCallback(() => {
    return kernelEditor.requireService(ILinkService) as LinkService | null;
  }, [kernelEditor]);

  const suppressLinkToolbar = useCallback(() => {
    const linkService = getLinkService();
    if (!linkService || linkToolbarSuppressionTokenRef.current) return;
    linkToolbarSuppressionTokenRef.current = linkService.suppressLinkToolbar('text-format-toolbar');
  }, [getLinkService]);

  const restoreLinkToolbar = useCallback(() => {
    const token = linkToolbarSuppressionTokenRef.current;
    if (!token) return;
    linkToolbarSuppressionTokenRef.current = null;
    getLinkService()?.restoreLinkToolbar(token);
  }, [getLinkService]);

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
        suppressLinkToolbar();
      } else {
        popupCharStylesEditorElem.style.opacity = '0';
        popupCharStylesEditorElem.style.transform = 'translate(-10000px, -10000px)';
        restoreLinkToolbar();
      }
    },
    [anchorElemRef, restoreLinkToolbar, suppressLinkToolbar],
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
    restoreLinkToolbar();
  }, [anchorElemRef, restoreLinkToolbar]);

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

  useLexicalEditor(
    (editor) => {
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
          restoreLinkToolbar();
          if (rootElement) {
            rootElement.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mouseup', handleMouseUp);
          }
        },
      );
    },
    [restoreLinkToolbar],
  );

  return (
    <div className={styles.anchor} ref={anchorElemRef}>
      <Block
        className={cx(isDarkMode ? styles.toolbarDark : styles.toolbarLight, className)}
        padding={4}
        ref={popupCharStylesEditorRef}
        variant={'outlined'}
      >
        {children}
      </Block>
    </div>
  );
};
