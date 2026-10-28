'use client';

import {
  $findTableNode,
  $getElementForTableNode,
  $isTableNode,
  $isTableSelection,
} from '@lexical/table';
import { cx } from '@lobehub/ui';
import EventEmitter from 'eventemitter3';
import type { LexicalEditor } from 'lexical';
import { $getNodeByKey, $getSelection, $isRangeSelection } from 'lexical';
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
import { IBlockMenuService } from '@/plugins/block/service';

import { TablePlugin } from '../plugin';
import { ITableControllerMenuService } from '../service';
import { $updateDOMForSelection, type TableSelectionOutlineRect } from '../utils';
import { selectionOutlineStyles, styles } from './style';
import TableGrips from './TableGrips';
import TableCellResizePlugin from './TableResize';
import type { ReactTablePluginProps } from './type';
import { useAutoFitPastedTable } from './useAutoFitPastedTable';
import { useScrollFocusedTableCellIntoView } from './useScrollFocusedTableCellIntoView';

const isEditorRootFocused = (activeEditor: LexicalEditor) => {
  const rootElement = activeEditor.getRootElement();
  const activeElement = rootElement?.ownerDocument.activeElement;

  return Boolean(
    rootElement &&
    activeElement &&
    (activeElement === rootElement || rootElement.contains(activeElement)),
  );
};

export const ReactTablePlugin: FC<ReactTablePluginProps> = ({
  className,
  locale,
  resizeMode = 'realtime',
}) => {
  const [editor] = useLexicalComposerContext();
  const [lexicalEditor, setLexicalEditor] = useState<LexicalEditor | null>(null);
  const [selectionOutlineRect, setSelectionOutlineRect] =
    useState<TableSelectionOutlineRect | null>(null);
  const eventEmitter = useMemo(() => {
    return new EventEmitter();
  }, []);

  useAutoFitPastedTable(lexicalEditor);
  useScrollFocusedTableCellIntoView(lexicalEditor);

  const selectionOutlineStyle = useMemo<CSSProperties | undefined>(
    () =>
      selectionOutlineRect
        ? {
            height: selectionOutlineRect.height,
            left: selectionOutlineRect.left,
            top: selectionOutlineRect.top,
            width: selectionOutlineRect.width,
          }
        : undefined,
    [selectionOutlineRect],
  );

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
      if (!isEditorRootFocused(activeEditor)) {
        updateSelectionOutlineRect(null);
        return;
      }

      activeEditor.read(() => {
        const selection = $getSelection();
        if (!$isTableSelection(selection) && !$isRangeSelection(selection)) {
          updateSelectionOutlineRect(null);
          return null;
        }
        const anchorNode = $isRangeSelection(selection)
          ? $getNodeByKey(selection.anchor.key)
          : null;
        const tableNode = $isTableSelection(selection)
          ? $getNodeByKey(selection.tableKey)
          : anchorNode
            ? $findTableNode(anchorNode)
            : null;

        if (!tableNode || !$isTableNode(tableNode)) {
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
      decorator: (node, lexicalEditor) => (
        <TableGrips
          blockMenuService={editor.requireService(IBlockMenuService)}
          editor={lexicalEditor}
          menuService={editor.requireService(ITableControllerMenuService)}
          node={node}
        />
      ),
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
    const unregisterRootListener = editor.registerRootListener((rootElement, prevRootElement) => {
      prevRootElement?.removeEventListener('focusin', scheduleRefreshSelectionOutlineRect);
      prevRootElement?.removeEventListener('focusout', scheduleRefreshSelectionOutlineRect);
      rootElement?.addEventListener('focusin', scheduleRefreshSelectionOutlineRect);
      rootElement?.addEventListener('focusout', scheduleRefreshSelectionOutlineRect);
    });

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      unregisterRootListener();
      unregisterUpdateListener();
      updateSelectionOutlineRect(null);
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
        </PortalAnchor>
      </>
    )
  );
};
