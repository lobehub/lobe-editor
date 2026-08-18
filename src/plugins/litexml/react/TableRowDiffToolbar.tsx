import { ActionIcon, Block } from '@lobehub/ui';
import { useThemeMode } from 'antd-style';
import type { LexicalEditor } from 'lexical';
import { $getNearestNodeFromDOMNode } from 'lexical';
import { Check, X } from 'lucide-react';
import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { DiffAction, LITEXML_DIFFNODE_COMMAND } from '../command/diffCommand';
import { $isTableRowDiffNode } from '../node/TableRowDiffNode';
import { styles } from './DiffNodeToolbar/style';

interface ActiveRow {
  left: number;
  nodeKey: string;
  top: number;
}

interface TableRowDiffToolbarProps {
  editor: LexicalEditor;
}

const TableRowDiffToolbar: FC<TableRowDiffToolbarProps> = ({ editor }) => {
  const [activeRow, setActiveRow] = useState<ActiveRow | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const t = useTranslation();
  const { isDarkMode } = useThemeMode();

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);
  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => setActiveRow(null), 120);
  }, [clearHideTimer]);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    const onPointerOver = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const row = target.closest<HTMLElement>('tr[data-diff-type]');
      if (!row || !root.contains(row)) return;

      const nodeKey = editor.getEditorState().read(() => {
        const node = $getNearestNodeFromDOMNode(row);
        return $isTableRowDiffNode(node) ? node.getKey() : null;
      });
      if (!nodeKey) return;

      clearHideTimer();
      const rect = row.getBoundingClientRect();
      setActiveRow({
        left: Math.max(8, rect.right - 72),
        nodeKey,
        top: Math.max(8, rect.top + 4),
      });
    };
    const onPointerOut = (event: PointerEvent) => {
      const related = event.relatedTarget;
      if (related instanceof Element && related.closest('tr[data-diff-type]')) return;
      scheduleHide();
    };

    root.addEventListener('pointerover', onPointerOver);
    root.addEventListener('pointerout', onPointerOut);
    return () => {
      clearHideTimer();
      root.removeEventListener('pointerover', onPointerOver);
      root.removeEventListener('pointerout', onPointerOut);
    };
  }, [clearHideTimer, editor, scheduleHide]);

  if (!activeRow || typeof document === 'undefined') return null;

  const dispatch = (action: DiffAction) => {
    editor.dispatchCommand(LITEXML_DIFFNODE_COMMAND, {
      action,
      nodeKey: activeRow.nodeKey,
    });
    setActiveRow(null);
  };

  return createPortal(
    <Block
      className={isDarkMode ? styles.toolbarDark : styles.toolbarLight}
      gap={2}
      horizontal
      onMouseEnter={clearHideTimer}
      onMouseLeave={scheduleHide}
      padding={2}
      shadow
      style={{ left: activeRow.left, position: 'fixed', top: activeRow.top, zIndex: 1100 }}
      variant={'outlined'}
    >
      <ActionIcon
        aria-label="Reject row change"
        className={styles.reject}
        danger
        icon={X}
        onClick={() => dispatch(DiffAction.Reject)}
        size={{ blockSize: 28, size: 16 }}
        title={t('modifier.reject')}
      />
      <ActionIcon
        aria-label="Accept row change"
        className={styles.accept}
        icon={Check}
        onClick={() => dispatch(DiffAction.Accept)}
        size={{ blockSize: 28, size: 16 }}
        title={t('modifier.accept')}
      />
    </Block>,
    document.body,
  );
};

TableRowDiffToolbar.displayName = 'TableRowDiffToolbar';

export default TableRowDiffToolbar;
