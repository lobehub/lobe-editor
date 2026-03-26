import type { SerializedLexicalNode } from 'lexical';
import type { ReactNode } from 'react';

export type LexicalDiffRowKind = 'delete' | 'equal' | 'insert' | 'modify';

export interface LexicalDiffCell {
  baseBlockType: string | null;
  block: SerializedLexicalNode | null;
  blockType: string | null;
}

export interface LexicalDiffRow {
  kind: LexicalDiffRowKind;
  newCell: LexicalDiffCell | null;
  oldCell: LexicalDiffCell | null;
}

export interface LexicalDiffBlockRenderContext {
  baseBlockType: string | null;
  blockType: string | null;
  newBaseBlockType: string | null;
  newBlockType: string | null;
  oldBaseBlockType: string | null;
  oldBlockType: string | null;
  renderDefaultNew: () => ReactNode;
  renderDefaultOld: () => ReactNode;
  row: LexicalDiffRow;
}

export type LexicalDiffBlockRenderer = (
  context: LexicalDiffBlockRenderContext,
) => { new?: ReactNode; old?: ReactNode } | null;
