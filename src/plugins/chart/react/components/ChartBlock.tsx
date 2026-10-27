'use client';

import { cx } from '@lobehub/ui';
import type { LexicalEditor } from 'lexical';
import { $getNodeByKey, CLICK_COMMAND, COMMAND_PRIORITY_LOW, HISTORY_PUSH_TAG } from 'lexical';
import { type FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { $isChartNode, type ChartNode } from '../../node/ChartNode';
import { getChartSource } from '../../utils/serialize';
import { type ChartSpec, parseChartSpec } from '../../utils/spec';
import { styles } from '../style';
import ChartSourceEditor from './ChartSourceEditor';
import ChartToolbar from './ChartToolbar';
import ChartView, { type ChartViewLabels } from './ChartView';

export interface ChartBlockProps {
  className?: string;
  editor: LexicalEditor;
  height?: number;
  node: ChartNode;
}

const ChartBlock: FC<ChartBlockProps> = ({ className, editor, height, node }) => {
  const t = useTranslation();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(node.getKey());
  const [editable, setEditable] = useState(() => editor.isEditable());
  const [editing, setEditing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();

  const { __raw: raw, __spec: spec } = node;
  const source = useMemo(() => getChartSource({ raw, spec }), [raw, spec]);

  const invalidReason = useMemo(() => {
    if (spec) return undefined;
    const result = parseChartSpec(raw);
    return result.ok ? undefined : result.error;
  }, [raw, spec]);

  const labels: ChartViewLabels = useMemo(
    () => ({
      apply: t('chart.apply'),
      editChart: t('chart.editChart'),
      editSource: t('chart.editSource'),
      invalid: t('chart.invalid'),
      loading: t('chart.loading'),
      reference: t('chart.reference'),
      showChart: t('chart.showChart'),
      source: t('chart.source'),
    }),
    [t],
  );

  useEffect(() => editor.registerEditableListener(setEditable), [editor]);

  useEffect(
    () =>
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          const element = editor.getElementByKey(node.getKey());
          if (!element || !element.contains(event.target as Node)) return false;
          if ((event.target as HTMLElement).closest('textarea, button')) return false;
          if (!event.shiftKey) clearSelection();
          setSelected(!isSelected);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    [clearSelection, editor, isSelected, node, setSelected],
  );

  const openSource = useCallback(() => {
    setDraft(source);
    setError(undefined);
    setFormOpen(false);
    setEditing(true);
  }, [source]);

  const writeSpec = useCallback(
    (next: ChartSpec) => {
      editor.update(
        () => {
          const latest = $getNodeByKey(node.getKey());
          if ($isChartNode(latest)) latest.setSpec(next);
        },
        { tag: HISTORY_PUSH_TAG },
      );
    },
    [editor, node],
  );

  const handleFormOpenChange = useCallback(
    (open: boolean) => {
      if (open && !spec) {
        openSource();
        return;
      }
      setFormOpen(open);
    },
    [openSource, spec],
  );

  const closeSource = useCallback(() => {
    setEditing(false);
    setError(undefined);
  }, []);

  const applySource = useCallback(() => {
    const result = parseChartSpec(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    writeSpec(result.spec);
    closeSource();
  }, [closeSource, draft, writeSpec]);

  const showSource = editable && editing;

  return (
    <div className={cx(styles.block, isSelected && 'selected', className)}>
      {editable && (
        <ChartToolbar
          formOpen={formOpen}
          onFormOpenChange={handleFormOpenChange}
          onSpecChange={writeSpec}
          onToggleSource={showSource ? closeSource : openSource}
          showSource={showSource}
          spec={spec ?? undefined}
        />
      )}
      {showSource ? (
        <ChartSourceEditor
          applyText={labels.apply}
          cancelText={t('cancel')}
          error={error}
          onApply={applySource}
          onCancel={closeSource}
          onChange={setDraft}
          value={draft}
        />
      ) : (
        <ChartView error={invalidReason} height={height} labels={labels} raw={raw} spec={spec} />
      )}
    </div>
  );
};

ChartBlock.displayName = 'ChartBlock';

export default ChartBlock;
