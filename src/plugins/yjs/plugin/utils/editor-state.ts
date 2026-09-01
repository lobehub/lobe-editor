import { $createParagraphNode, $getRoot, HISTORY_MERGE_TAG, SKIP_COLLAB_TAG } from 'lexical';
import type { EditorState, LexicalEditor } from 'lexical';

import type { YjsInitialEditorState } from '../types';

interface InitializeEditorOptions {
  discrete?: boolean;
  skipIfNotEmpty?: boolean;
  tag?: string;
}

export function initializeEditor(
  editor: LexicalEditor,
  initialEditorState?: YjsInitialEditorState,
  options: InitializeEditorOptions = {},
): void {
  const { discrete, skipIfNotEmpty = true, tag = HISTORY_MERGE_TAG } = options;
  const updateOptions = Object.keys({
    ...(discrete ? { discrete: true as const } : {}),
    ...(tag ? { tag } : {}),
  }).length
    ? {
        ...(discrete ? { discrete: true as const } : {}),
        ...(tag ? { tag } : {}),
      }
    : undefined;

  if (initialEditorState && typeof initialEditorState !== 'function') {
    const shouldSkip = editor.getEditorState().read(() => {
      return skipIfNotEmpty && !$getRoot().isEmpty();
    });

    if (shouldSkip) {
      return;
    }

    editor.setEditorState(
      typeof initialEditorState === 'string'
        ? editor.parseEditorState(initialEditorState)
        : initialEditorState,
      updateOptions,
    );
    return;
  }

  editor.update(() => {
    const root = $getRoot();

    if (skipIfNotEmpty && !root.isEmpty()) {
      return;
    }

    if (typeof initialEditorState === 'function') {
      initialEditorState(editor);
      return;
    }

    root.append($createParagraphNode());
  }, updateOptions);
}

export function createEmptyPreviousEditorState(editor: LexicalEditor): EditorState {
  return editor.parseEditorState(
    JSON.stringify({
      root: {
        children: [],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    }),
  );
}

export function clearEditorSkipCollab(editor: LexicalEditor): void {
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      root.select();
    },
    {
      tag: SKIP_COLLAB_TAG,
    },
  );
}
