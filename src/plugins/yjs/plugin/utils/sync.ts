import { type Binding, type Provider, syncLexicalUpdateToYjs } from '@lexical/yjs';
import { COLLABORATION_TAG } from 'lexical';
import type { EditorState } from 'lexical';

import { createEmptyPreviousEditorState } from './editor-state';
import { ensureYjsNodePropertiesFromEditorState } from './node-properties';

export function syncCurrentEditorStateToYjs(
  binding: Binding,
  provider: Provider,
  prevEditorState: EditorState = createEmptyPreviousEditorState(binding.editor),
): void {
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
}

export function hydrateLexicalFromYjsState(binding: Binding): void {
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
      skipTransforms: true,
      tag: COLLABORATION_TAG,
    },
  );
}
