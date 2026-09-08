import type { BaseSelection, LexicalEditor, LexicalNode, NodeKey } from 'lexical';

import { genServiceId } from '@/editor-kernel';
import type { IServiceID } from '@/types';

import type {
  HoleNormalizationGuard,
  HoleNormalizationNodeConstructor,
} from '../node/hole-normalization';

export type HoleBoundaryPosition = 'after' | 'before' | 'outside' | 'selected';
export type HoleBoundarySide = 'after' | 'before';

export interface HoleBoundaryState {
  readonly covered: boolean;
  readonly directNodeSelection: boolean;
  readonly position: HoleBoundaryPosition;
  readonly targetKey: NodeKey;
}

export interface HoleBoundaryChange {
  readonly next: HoleBoundaryState;
  readonly previous: HoleBoundaryState;
}

export interface HoleTextContentContext {
  editor: LexicalEditor;
  selection: BaseSelection;
}

export type HoleTargetTextSerializer = (
  node: LexicalNode,
  context: HoleTextContentContext,
) => string | undefined;

export interface HoleTargetRegistrationOptions {
  serializeTextContent?: HoleTargetTextSerializer;
}

export interface IHoleService {
  registerTarget(
    target: HoleNormalizationNodeConstructor,
    options?: HoleTargetRegistrationOptions,
  ): () => void;
  setNormalizationGuard(guard?: HoleNormalizationGuard): () => void;
  /** Normalize nodes in the active incoming parse state before it is committed. */
  normalizeIncoming(): boolean;
  reconcile(): void;
  prepareBoundaryInsertion(selection: BaseSelection): boolean;
  serializeTextContent(nodes: readonly LexicalNode[], context: HoleTextContentContext): string;
  selectBoundary(targetKey: NodeKey, side: HoleBoundarySide): boolean;
  getBoundaryState(targetKey: NodeKey): HoleBoundaryState;
  subscribe(listener: (change: HoleBoundaryChange) => void): () => void;
}

export const IHoleService: IServiceID<IHoleService> = genServiceId<IHoleService>('HoleService');
