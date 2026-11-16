import type { LexicalEditor, NodeKey } from 'lexical';
import { useEffect, useState } from 'react';

import { getKernelFromEditor } from '@/editor-kernel/utils';
import { $readHoleBoundaryState } from '@/plugins/common/service/hole';
import { type HoleBoundaryChange, IHoleService } from '@/plugins/common/service/i-hole-service';

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
  const state = $readHoleBoundaryState(nodeKey);
  return {
    covered: state.covered,
    directNodeSelection: state.directNodeSelection,
  };
};

export const useArtifactSelectionState = (
  editor: LexicalEditor,
  nodeKey: NodeKey,
): ArtifactSelectionState => {
  const [selectionState, setSelectionState] = useState(EMPTY_ARTIFACT_SELECTION_STATE);

  useEffect(() => {
    const holeService = getKernelFromEditor(editor)?.requireService(IHoleService);
    if (!holeService) {
      setSelectionState(EMPTY_ARTIFACT_SELECTION_STATE);
      return;
    }

    const readSelection = (boundaryState = holeService.getBoundaryState(nodeKey)) => {
      const next = {
        covered: boundaryState.covered,
        directNodeSelection: boundaryState.directNodeSelection,
      };
      setSelectionState((current) =>
        current.covered === next.covered && current.directNodeSelection === next.directNodeSelection
          ? current
          : next,
      );
    };

    readSelection();
    const unsubscribeHole = holeService.subscribe((change: HoleBoundaryChange) => {
      if (change.next.targetKey === nodeKey) readSelection(change.next);
      else if (change.previous.targetKey === nodeKey) readSelection();
    });
    return () => {
      unsubscribeHole();
    };
  }, [editor, nodeKey]);

  return selectionState;
};
