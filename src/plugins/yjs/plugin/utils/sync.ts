import { type Binding, type Provider, syncLexicalUpdateToYjs } from '@lexical/yjs';
import {
  $getRoot,
  $isElementNode,
  COLLABORATION_TAG,
  type EditorState,
  HISTORIC_TAG,
  type LexicalNode,
} from 'lexical';

import { createEmptyPreviousEditorState } from './editor-state';
import { ensureYjsNodePropertiesFromEditorState } from './node-properties';

/** Transactions performed for hydration, persistence replay, and server
 * projection must never be captured by a browser's human undo manager. */
export const YJS_SYSTEM_ORIGIN = Symbol('lobe-yjs-system');

export function transactWithYjsOrigin<T>(binding: Binding, origin: unknown, callback: () => T): T {
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
  const hasDOMRoot = (): boolean => {
    try {
      return binding.editor.getRootElement() !== null;
    } catch {
      // Headless/restricted editors intentionally reject DOM accessors.
      return false;
    }
  };
  const markHydratedAncestorsDirty = (node: LexicalNode): void => {
    if (!$isElementNode(node)) return;
    if (node.getType() === 'hole') {
      // Lexical's clean-element fast path reuses a private DOM subtree-text
      // cache. HoleNode's semantic getTextContent intentionally excludes its
      // boundary cursors, so invalidate only that derived DOM cache before
      // letting the dirty regular ancestor reconcile the clean Hole. We do
      // not write RootNode.__cachedText or any editor/Yjs state here.
      // See docs/lexical-yjs-compatibility.md before upgrading Lexical.
      if (!hasDOMRoot()) return;
      try {
        const element = binding.editor.getElementByKey(node.getKey()) as
          (HTMLElement & { __lexicalTextContent?: string }) | null;
        if (element) Reflect.deleteProperty(element, '__lexicalTextContent');
      } catch {
        // Restricted DOM facades can expose a root but reject element lookup.
      }
      return;
    }
    node.markDirty();
    node.getChildren().forEach(markHydratedAncestorsDirty);
  };

  binding.editor.update(
    () => {
      root.applyChildrenYjsDelta(binding, sharedType.toDelta());
      root.syncChildrenFromYjs(binding);
    },
    {
      discrete: options.discrete ? true : undefined,
      onUpdate: () => {
        if (!hasDOMRoot()) return;
        // Hydration can leave the root cache based on DOM subtree text from
        // before HoleNode children were rebuilt. An ancestor reconciliation
        // after the first commit lets clean HoleNodes use their semantic
        // getTextContent() without forcing their cursor leaves through the
        // DOM cache again. The collaboration and historic tags, together
        // with skip-transforms, keep this cache-only refresh out of Yjs and
        // local undo history.
        binding.editor.update(() => markHydratedAncestorsDirty($getRoot()), {
          discrete: true,
          skipTransforms: true,
          tag: [COLLABORATION_TAG, HISTORIC_TAG],
        });
      },
      skipTransforms: true,
      tag: [COLLABORATION_TAG, HISTORIC_TAG],
    },
  );
}
