import { mergeRegister } from '@lexical/utils';
import { Block, LOBE_THEME_APP_ID } from '@lobehub/ui';
import { cx, useThemeMode } from 'antd-style';
import type { LexicalEditor } from 'lexical';
import {
  $getSelection,
  COMMAND_PRIORITY_LOW,
  getDOMSelection,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import type { FC } from 'react';
import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLexicalComposerContext, useLexicalEditor } from '@/editor-kernel/react';
import { ILinkService } from '@/plugins/link';
import { createDebugLogger } from '@/utils/debug';

import { HIDE_TOOLBAR_COMMAND, registerToolbarCommand } from '../command';
import { getDOMRangeRect } from '../utils/getDOMRangeRect';
import { setFloatingElemPosition } from '../utils/setFloatingElemPosition';
import { styles } from './style';
import type { ReactToolbarPluginProps } from './type';

const resolveDefaultPortalContainer = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  return document.getElementById(LOBE_THEME_APP_ID) ?? document.body;
};

export const ReactToolbarPlugin: FC<ReactToolbarPluginProps> = ({
  className,
  children,
  getPopupContainer,
  usePortal = true,
  zIndex,
}) => {
  const popupCharStylesEditorRef = useRef<HTMLDivElement | null>(null);
  const anchorElemRef = useRef<HTMLDivElement | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [kernelEditor] = useLexicalComposerContext();
  const { isDarkMode } = useThemeMode();
  const isMouseDownRef = useRef(false);
  const logger = createDebugLogger('plugin', 'toolbar');

  const resolvePortalContainer = useCallback(() => {
    if (!usePortal) return null;
    if (getPopupContainer) return getPopupContainer();
    return resolveDefaultPortalContainer();
  }, [getPopupContainer, usePortal]);

  const syncPortalContainer = useCallback(() => {
    const nextContainer = resolvePortalContainer();
    setPortalContainer((current) => (current === nextContainer ? current : nextContainer));
  }, [resolvePortalContainer]);

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

  useLexicalEditor(
    (editor) => {
      if (!usePortal) {
        setPortalContainer(null);
        return;
      }

      syncPortalContainer();

      return editor.registerRootListener(syncPortalContainer);
    },
    [syncPortalContainer, usePortal],
  );

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
    const editorWindow =
      editor._window ?? rootElement?.ownerDocument.defaultView ?? globalThis.window ?? null;
    let animationFrameId: number | null = null;
    const updateToolbarPosition = () => {
      if (!editorWindow || isMouseDownRef.current || animationFrameId !== null) {
        return;
      }

      animationFrameId = editorWindow.requestAnimationFrame(() => {
        animationFrameId = null;
        editor.getEditorState().read(() => {
          $updateTextFormatFloatingToolbar(editor);
        });
      });
    };
    const scrollListenerOptions = { capture: true, passive: true } as const;
    const scrollCleanupOptions = { capture: true } as const;
    const resizeListenerOptions = { passive: true } as const;

    if (rootElement) {
      rootElement.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mouseup', handleMouseUp);
    }
    if (editorWindow) {
      editorWindow.addEventListener('scroll', updateToolbarPosition, scrollListenerOptions);
      editorWindow.document.addEventListener(
        'scroll',
        updateToolbarPosition,
        scrollListenerOptions,
      );
      editorWindow.addEventListener('resize', updateToolbarPosition, resizeListenerOptions);
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
        if (editorWindow) {
          editorWindow.removeEventListener('scroll', updateToolbarPosition, scrollCleanupOptions);
          editorWindow.document.removeEventListener(
            'scroll',
            updateToolbarPosition,
            scrollCleanupOptions,
          );
          editorWindow.removeEventListener('resize', updateToolbarPosition);
          if (animationFrameId !== null) {
            editorWindow.cancelAnimationFrame(animationFrameId);
          }
        }
      },
    );
  });

  const toolbarNode = (
    <div
      className={usePortal ? styles.portalAnchor : styles.anchor}
      ref={anchorElemRef}
      style={usePortal && zIndex !== undefined ? { zIndex } : undefined}
    >
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

  if (usePortal) {
    return portalContainer ? createPortal(toolbarNode, portalContainer) : null;
  }

  return toolbarNode;
};
