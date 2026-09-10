import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import { $getNodeByKey, $getSelection, $isNodeSelection, $isRangeSelection } from 'lexical';

import type { type HoleBoundaryChange,IHoleService  } from '@/plugins/common/service/i-hole-service';

import { $isBlockFileNode, type BlockFileNode } from '../node/BlockFileNode';
import { $isFileNode, type FileNode } from '../node/FileNode';

type FileUploadNode = FileNode | BlockFileNode;

const getAttachedFileNode = (key: string): FileUploadNode | null => {
  const node = $getNodeByKey(key);
  if (!node || (!$isFileNode(node) && !$isBlockFileNode(node)) || !node.isAttached()) {
    return null;
  }
  return node;
};

export const settleFileUpload = (
  editor: LexicalEditor,
  key: string,
  settle: (node: FileUploadNode) => void,
): void => {
  editor.update(() => {
    const node = getAttachedFileNode(key);
    if (node) settle(node);
  });
};

export function registerFileNodeSelectionObserver(
  editor: LexicalEditor,
  holeService: IHoleService | null,
): () => void {
  const selectFileKeys: string[] = [];
  const setSelected = (key: string, selected: boolean): void => {
    editor.getElementByKey(key)?.classList.toggle('selected', selected);
  };

  const updateSelection = editor.registerUpdateListener(({ editorState }) => {
    const selection = editorState.read(() => $getSelection());
    const newSelectFileKeys: string[] = [];
    if ($isNodeSelection(selection)) {
      const nodes = editorState.read(() => selection.getNodes());
      nodes.forEach((node) => {
        if (node.getType() === 'file') {
          newSelectFileKeys.push(node.getKey());
        }
      });
    } else if ($isRangeSelection(selection) && !selection.isCollapsed()) {
      editorState.read(() => {
        selection.getNodes().forEach((node) => {
          if (node.getType() === 'file') {
            newSelectFileKeys.push(node.getKey());
          }
        });
      });
    }
    const removeKeys = selectFileKeys.filter((key) => !newSelectFileKeys.includes(key));
    const addKeys = newSelectFileKeys.filter((key) => !selectFileKeys.includes(key));
    selectFileKeys.length = 0;
    selectFileKeys.push(...newSelectFileKeys);

    removeKeys.forEach((key) => setSelected(key, false));
    addKeys.forEach((key) => setSelected(key, true));
  });

  const syncHoleSelection = ({ next }: HoleBoundaryChange): void => {
    if (!holeService) return;
    const state = holeService.getBoundaryState(next.targetKey);
    const isBlockFile = editor.getEditorState().read(() => {
      const node = $getNodeByKey(next.targetKey);
      return Boolean(node && $isBlockFileNode(node));
    });
    if (isBlockFile) {
      setSelected(next.targetKey, state.covered || state.position === 'selected');
    }
  };

  const unsubscribeHole = holeService?.subscribe(syncHoleSelection) ?? (() => {});

  return mergeRegister(updateSelection, unsubscribeHole);
}
