import type {
  EditorState,
  LexicalEditor,
  SerializedEditorState,
  SerializedLexicalNode,
} from 'lexical';
import { $createParagraphNode, $getRoot, HISTORY_MERGE_TAG, SKIP_COLLAB_TAG } from 'lexical';

import { $normalizeNodeIds, migrateSerializedNodeIds } from '@/plugins/common/node/node-id';

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

    const serializedState =
      typeof initialEditorState === 'string'
        ? (JSON.parse(initialEditorState) as SerializedEditorState<SerializedLexicalNode>)
        : initialEditorState.toJSON();
    migrateSerializedNodeIds((serializedState as { root?: unknown }).root);
    const parsedState = editor.parseEditorState(
      serializedState as SerializedEditorState<SerializedLexicalNode>,
      () => {
        $normalizeNodeIds($getRoot());
      },
    );
    editor.setEditorState(parsedState, updateOptions);
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
