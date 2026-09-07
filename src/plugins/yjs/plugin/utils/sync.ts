import { type Binding, type Provider, syncLexicalUpdateToYjs } from '@lexical/yjs';
import type { EditorState } from 'lexical';
import { COLLABORATION_TAG } from 'lexical';

import { createEmptyPreviousEditorState } from './editor-state';
import { ensureYjsNodePropertiesFromEditorState } from './node-properties';

/** Transactions performed for hydration, persistence replay, and server
 * projection must never be captured by a browser's human undo manager. */
export const YJS_SYSTEM_ORIGIN = Symbol('lobe-yjs-system');

export function transactWithYjsOrigin<T>(
  binding: Binding,
  origin: unknown,
  callback: () => T,
): T {
  let result!: T;
  binding.doc.transact(() => {
    result = callback();
  }, origin);
  return result;
}

export function syncCurrentEditorStateToYjs(
  binding: Binding,
  provider: Provider,
  prevEditorState: EditorState = createEmptyPreviousEditorState(binding.editor),
  origin: unknown = YJS_SYSTEM_ORIGIN,
): void {
  transactWithYjsOrigin(binding, origin, () => {
    const editorState = binding.editor.getEditorState();
    ensureYjsNodePropertiesFromEditorState(binding, editorState);

    syncLexicalUpdateToYjs(
      binding,
      provider,
      prevEditorState,
      editorState,
      new Map([['root', true as never]]),
      new Set(),
      new Set(),
      new Set(),
    );
  });
}

export function hydrateLexicalFromYjsState(
  binding: Binding,
  options: { discrete?: boolean } = {},
): void {
  const root = binding.root as Binding['root'] & {
    applyChildrenYjsDelta: (binding: Binding, deltas: unknown) => void;
    syncChildrenFromYjs: (binding: Binding) => void;
  };
  const sharedType = root.getSharedType();

  binding.editor.update(
    () => {
      root.applyChildrenYjsDelta(binding, sharedType.toDelta());
      root.syncChildrenFromYjs(binding);
    },
    {
      discrete: options.discrete ? true : undefined,
      skipTransforms: true,
      tag: COLLABORATION_TAG,
    },
  );
}
