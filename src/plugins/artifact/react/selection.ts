import type { EditorState, LexicalEditor, NodeKey } from 'lexical';
import {
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
} from 'lexical';
import { useEffect, useState } from 'react';

import { $isHoleNode } from '@/plugins/common/node/hole';

import { $isArtifactNode } from '../node/ArtifactNode';

export interface ArtifactSelectionState {
  covered: boolean;
  directNodeSelection: boolean;
}

export const EMPTY_ARTIFACT_SELECTION_STATE: ArtifactSelectionState = {
  covered: false,
  directNodeSelection: false,
};

/** Must be called inside an editor read/update scope. */
export const $getArtifactSelectionState = (nodeKey: NodeKey): ArtifactSelectionState => {
  const artifact = $getNodeByKey(nodeKey);
  const selection = $getSelection();
  if (!$isArtifactNode(artifact) || !selection) return EMPTY_ARTIFACT_SELECTION_STATE;

  const selectedNodes = selection.getNodes();
  const hole = artifact.getParent();
  if ($isRangeSelection(selection) && selection.isCollapsed()) {
    return EMPTY_ARTIFACT_SELECTION_STATE;
  }

  if ($isNodeSelection(selection)) {
    return {
      covered: selectedNodes.some(
        (selectedNode) =>
          selectedNode.is(artifact) ||
          ($isHoleNode(selectedNode) && selectedNode.isParentOf(artifact)),
      ),
      directNodeSelection: selection.has(nodeKey),
    };
  }

  if (!$isRangeSelection(selection)) return EMPTY_ARTIFACT_SELECTION_STATE;
  const coveredBySelectedNode = selectedNodes.some(
    (selectedNode) =>
      selectedNode.is(artifact) ||
      ($isElementNode(selectedNode) && selectedNode.isParentOf(artifact)),
  );
  const coveredByHoleBoundary =
    $isHoleNode(hole) &&
    Boolean(hole.getBeforeCursor()?.isSelected(selection)) &&
    Boolean(hole.getAfterCursor()?.isSelected(selection));

  return {
    covered: coveredBySelectedNode || coveredByHoleBoundary,
    directNodeSelection: false,
  };
};

export const useArtifactSelectionState = (
  editor: LexicalEditor,
  nodeKey: NodeKey,
): ArtifactSelectionState => {
  const [selectionState, setSelectionState] = useState(EMPTY_ARTIFACT_SELECTION_STATE);

  useEffect(() => {
    const readSelection = (editorState: EditorState = editor.getEditorState()) => {
      const next = editorState.read(() => $getArtifactSelectionState(nodeKey));
      setSelectionState((current) =>
        current.covered === next.covered && current.directNodeSelection === next.directNodeSelection
          ? current
          : next,
      );
    };

    readSelection();
    return editor.registerUpdateListener(({ editorState }) => readSelection(editorState));
  }, [editor, nodeKey]);

  return selectionState;
};
