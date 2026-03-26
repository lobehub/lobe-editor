import { cx } from 'antd-style';
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';

import { LexicalRenderer } from './LexicalRenderer';
import { computeLexicalDiffRows } from './diff/compute';
import { styles } from './diff/style';
import type {
  LexicalDiffBlockRenderContext,
  LexicalDiffBlockRenderer,
  LexicalDiffRow,
} from './diff/types';
import type { LexicalRendererProps } from './types';

export type {
  LexicalDiffBlockRenderContext,
  LexicalDiffBlockRenderer,
  LexicalDiffCell,
  LexicalDiffRow,
  LexicalDiffRowKind,
} from './diff/types';

export interface LexicalDiffProps {
  blockRenderers?: Record<string, LexicalDiffBlockRenderer>;
  className?: string;
  extraNodes?: LexicalRendererProps['extraNodes'];
  labels?: {
    new?: ReactNode;
    old?: ReactNode;
  };
  newValue: SerializedEditorState;
  oldValue: SerializedEditorState;
  overrides?: LexicalRendererProps['overrides'];
  renderBlockDiff?: LexicalDiffBlockRenderer;
  renderContext?: LexicalRendererProps['renderContext'];
  style?: CSSProperties;
  variant?: LexicalRendererProps['variant'];
}

function wrapBlock(block: SerializedLexicalNode): SerializedEditorState {
  return {
    root: {
      children: [block],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as SerializedEditorState;
}

function RowCell({ className, content }: { className?: string; content: ReactNode }) {
  return <div className={className}>{content}</div>;
}

export function LexicalDiff({
  oldValue,
  newValue,
  variant = 'default',
  extraNodes,
  overrides,
  renderContext,
  labels,
  blockRenderers,
  renderBlockDiff,
  className,
  style,
}: LexicalDiffProps) {
  const rows = useMemo(() => computeLexicalDiffRows(oldValue, newValue), [oldValue, newValue]);

  const renderDefaultCell = (block: SerializedLexicalNode | null) => {
    if (!block) return null;

    return (
      <LexicalRenderer
        extraNodes={extraNodes}
        overrides={overrides}
        renderContext={renderContext}
        value={wrapBlock(block)}
        variant={variant}
      />
    );
  };

  const renderRow = (row: LexicalDiffRow, index: number) => {
    const blockType =
      row.oldCell?.blockType && row.newCell?.blockType
        ? row.oldCell.blockType === row.newCell.blockType
          ? row.oldCell.blockType
          : null
        : (row.oldCell?.blockType ?? row.newCell?.blockType ?? null);
    const baseBlockType =
      row.oldCell?.baseBlockType && row.newCell?.baseBlockType
        ? row.oldCell.baseBlockType === row.newCell.baseBlockType
          ? row.oldCell.baseBlockType
          : null
        : (row.oldCell?.baseBlockType ?? row.newCell?.baseBlockType ?? null);

    const context: LexicalDiffBlockRenderContext = {
      baseBlockType,
      blockType,
      newBaseBlockType: row.newCell?.baseBlockType ?? null,
      newBlockType: row.newCell?.blockType ?? null,
      oldBaseBlockType: row.oldCell?.baseBlockType ?? null,
      oldBlockType: row.oldCell?.blockType ?? null,
      renderDefaultNew: () => renderDefaultCell(row.newCell?.block ?? null),
      renderDefaultOld: () => renderDefaultCell(row.oldCell?.block ?? null),
      row,
    };

    const renderers = [
      blockType ? blockRenderers?.[blockType] : undefined,
      baseBlockType && baseBlockType !== blockType ? blockRenderers?.[baseBlockType] : undefined,
      renderBlockDiff,
    ];

    let rendered: ReturnType<LexicalDiffBlockRenderer> | undefined;
    for (const renderer of renderers) {
      if (!renderer) continue;
      const next = renderer(context);
      if (next === null) continue;
      rendered = next;
      break;
    }

    const oldContent = rendered?.old ?? context.renderDefaultOld();
    const newContent = rendered?.new ?? context.renderDefaultNew();

    return (
      <div className={styles.row} key={`row-${index}`}>
        <RowCell
          className={cx(
            styles.cell,
            styles.cellOld,
            !row.oldCell && styles.emptyCell,
            row.kind === 'delete' && styles.deleteCell,
          )}
          content={oldContent}
        />
        <RowCell
          className={cx(
            styles.cell,
            !row.newCell && styles.emptyCell,
            row.kind === 'insert' && styles.insertCell,
          )}
          content={newContent}
        />
      </div>
    );
  };

  return (
    <div className={cx(styles.root, className)} style={style}>
      <div className={styles.header}>
        <div className={cx(styles.headerCell, styles.headerOld)}>{labels?.old ?? 'Old'}</div>
        <div className={styles.headerCell}>{labels?.new ?? 'New'}</div>
      </div>
      <div className={styles.body}>{rows.map(renderRow)}</div>
    </div>
  );
}
