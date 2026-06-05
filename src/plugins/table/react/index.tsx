'use client';

import { $findTableNode, $getElementForTableNode, $isTableSelection } from '@lexical/table';
import { cx } from 'antd-style';
import EventEmitter from 'eventemitter3';
import { $getSelection, $isRangeSelection, LexicalEditor } from 'lexical';
import {
  type CSSProperties,
  type FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import PortalAnchor from '@/editor-kernel/react/PortalAnchor';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { TablePlugin } from '../plugin';
import { ITableControllerMenuService } from '../service';
import { $updateDOMForSelection, type TableSelectionOutlineRect } from '../utils';
import TableActionMenuPlugin from './TableActionMenu';
import TableColController from './TableColController';
import TableHoverActionsPlugin from './TableHoverActions';
import TableCellResizePlugin from './TableResize';
import TableRowController from './TableRowController';
import { selectionOutlineStyles, styles } from './style';
import { ReactTablePluginProps } from './type';

type SelectionOutlinePreviewSide = 'bottom' | 'left' | 'right' | 'top';

export const ReactTablePlugin: FC<ReactTablePluginProps> = ({
  className,
  locale,
  resizeMode = 'realtime',
}) => {
  const [editor] = useLexicalComposerContext();
  const [lexicalEditor, setLexicalEditor] = useState<LexicalEditor | null>(null);
  const [selectionOutlineRect, setSelectionOutlineRect] =
    useState<TableSelectionOutlineRect | null>(null);
  const [selectionOutlinePreviewSide, setSelectionOutlinePreviewSide] =
    useState<SelectionOutlinePreviewSide | null>(null);
  const eventEmitter = useMemo(() => {
    return new EventEmitter();
  }, []);

  const selectionOutlineStyle = useMemo<CSSProperties | undefined>(() => {
    if (!selectionOutlineRect) {
      return undefined;
    }

    const style: CSSProperties = {
      height: selectionOutlineRect.height,
      left: selectionOutlineRect.left,
      top: selectionOutlineRect.top,
      width: selectionOutlineRect.width,
    };

    if (!selectionOutlinePreviewSide) {
      return style;
    }

    return {
      ...style,
      borderBottomWidth: selectionOutlinePreviewSide === 'bottom' ? undefined : 0,
      borderLeftWidth: selectionOutlinePreviewSide === 'left' ? undefined : 0,
      borderRightWidth: selectionOutlinePreviewSide === 'right' ? undefined : 0,
      borderTopWidth: selectionOutlinePreviewSide === 'top' ? undefined : 0,
    };
  }, [selectionOutlinePreviewSide, selectionOutlineRect]);

  const updateSelectionOutlineRect = useCallback((rect: TableSelectionOutlineRect | null) => {
    setSelectionOutlineRect((current) => {
      if (
        current?.height === rect?.height &&
        current?.left === rect?.left &&
        current?.top === rect?.top &&
        current?.width === rect?.width
      ) {
        return current;
      }

      return rect;
    });
  }, []);

  const refreshSelectionOutlineRect = useCallback(
    (activeEditor: LexicalEditor) => {
      activeEditor.read(() => {
        const selection = $getSelection();
        if (!$isTableSelection(selection) && !$isRangeSelection(selection)) {
          updateSelectionOutlineRect(null);
          return null;
        }
        const tableNode = $findTableNode(selection.anchor.getNode());
        if (!tableNode) {
          updateSelectionOutlineRect(null);
          return null;
        }
        updateSelectionOutlineRect(
          $updateDOMForSelection(
            activeEditor,
            $getElementForTableNode(activeEditor, tableNode),
            selection,
          ),
        );
      });
    },
    [updateSelectionOutlineRect],
  );

  useEffect(() => {
    if (!lexicalEditor || !selectionOutlineRect) {
      return;
    }

    let frame: number | null = null;
    const scheduleRefresh = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }

      frame = requestAnimationFrame(() => {
        frame = null;
        refreshSelectionOutlineRect(lexicalEditor);
      });
    };

    document.addEventListener('scroll', scheduleRefresh, true);
    window.addEventListener('resize', scheduleRefresh);

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      document.removeEventListener('scroll', scheduleRefresh, true);
      window.removeEventListener('resize', scheduleRefresh);
    };
  }, [lexicalEditor, refreshSelectionOutlineRect, selectionOutlineRect]);

  useLayoutEffect(() => {
    if (locale) {
      editor.registerLocale(locale);
    }
    editor.registerPlugin(TablePlugin, {
      decoratorCol: (node, lexicalEditor) => {
        return (
          <TableColController
            editor={lexicalEditor}
            key={node.getColumnCount()}
            menuService={editor.requireService(ITableControllerMenuService)}
            node={node}
            onColumnMetricsChange={() => {
              requestAnimationFrame(() => {
                refreshSelectionOutlineRect(lexicalEditor);
              });
            }}
            onInsertPreviewChange={setSelectionOutlinePreviewSide}
          />
        );
      },
      decoratorRow: (node, lexicalEditor) => {
        return (
          <TableRowController
            editor={lexicalEditor}
            menuService={editor.requireService(ITableControllerMenuService)}
            node={node}
            onInsertPreviewChange={setSelectionOutlinePreviewSide}
          />
        );
      },
      theme: cx(styles, className),
    });
  }, []);

  useLexicalEditor((editor) => {
    setLexicalEditor(editor);
    let frame: number | null = null;
    const scheduleRefreshSelectionOutlineRect = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }

      frame = requestAnimationFrame(() => {
        frame = null;
        refreshSelectionOutlineRect(editor);
      });
    };

    const unregisterUpdateListener = editor.registerUpdateListener(
      scheduleRefreshSelectionOutlineRect,
    );
    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      unregisterUpdateListener();
      updateSelectionOutlineRect(null);
      setSelectionOutlinePreviewSide(null);
      setLexicalEditor(null);
    };
  }, []);

  return (
    lexicalEditor && (
      <>
        <TableCellResizePlugin
          editor={lexicalEditor}
          eventEmitter={eventEmitter}
          resizeMode={resizeMode}
        />
        <PortalAnchor>
          {selectionOutlineStyle && (
            <div
              className={selectionOutlineStyles.outline}
              contentEditable={false}
              style={selectionOutlineStyle}
            />
          )}
          <TableActionMenuPlugin editor={lexicalEditor} />
          <TableHoverActionsPlugin editor={lexicalEditor} />
        </PortalAnchor>
      </>
    )
  );
};
