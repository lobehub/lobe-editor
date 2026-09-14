import type { LexicalEditor, LexicalNode, NodeKey } from 'lexical';
import { $getRoot, $isElementNode } from 'lexical';

import type { IEditorKernel } from '@/types';

import { $isHoleNode } from '../node/hole';
import type { HoleBoundaryChange, IHoleService } from '../service/i-hole-service';

/**
 * Project semantic Hole coverage onto opt-in target hosts. DOM bookkeeping is
 * kept at the Common plugin boundary so the headless Hole service remains
 * usable without a Lexical DOM adapter.
 */
export const registerHoleSelectionDOM = (
  kernel: IEditorKernel,
  editor: LexicalEditor,
  holeService: IHoleService,
): (() => void) => {
  const selectedKeys = new Set<NodeKey>();
  const selectedElements = new Map<NodeKey, HTMLElement>();
  let rootElement: HTMLElement | null = null;

  const clearTarget = (targetKey: NodeKey): void => {
    selectedElements.get(targetKey)?.removeAttribute('data-hole-selected');
    selectedElements.delete(targetKey);
  };

  const clearDOM = (): void => {
    selectedElements.forEach((element) => {
      element.removeAttribute('data-hole-selected');
    });
    selectedElements.clear();
  };

  const projectTarget = (targetKey: NodeKey): void => {
    if (!rootElement) {
      clearTarget(targetKey);
      return;
    }

    const targetElement = editor.getElementByKey(targetKey);
    const targetHost =
      selectedKeys.has(targetKey) && targetElement?.dataset.holeSelectionTarget === 'true'
        ? targetElement
        : null;
    const previousElement = selectedElements.get(targetKey);

    if (previousElement && previousElement !== targetHost) {
      previousElement.removeAttribute('data-hole-selected');
    }

    if (!targetHost) {
      targetElement?.removeAttribute('data-hole-selected');
      selectedElements.delete(targetKey);
      return;
    }

    targetHost.dataset.holeSelected = 'true';
    selectedElements.set(targetKey, targetHost);
  };

  const readSelectedKeys = (): Set<NodeKey> => {
    const next = new Set<NodeKey>();
    editor.getEditorState().read(() => {
      const visit = (node: LexicalNode): void => {
        if ($isHoleNode(node)) {
          node.getContentChildren().forEach((target) => {
            if (holeService.getBoundaryState(target.getKey()).covered) {
              next.add(target.getKey());
            }
          });
        }
        if ($isElementNode(node)) node.getChildren().forEach(visit);
      };

      $getRoot().getChildren().forEach(visit);
    });
    return next;
  };

  const syncDOM = (): void => {
    if (!rootElement) {
      clearDOM();
      return;
    }

    const keys = new Set([...selectedKeys, ...selectedElements.keys()]);
    keys.forEach(projectTarget);
  };

  const syncSelection = ({ next }: HoleBoundaryChange): void => {
    if (next.covered) selectedKeys.add(next.targetKey);
    else selectedKeys.delete(next.targetKey);
    projectTarget(next.targetKey);
  };

  const unregisterSelection = holeService.subscribe(syncSelection);
  const unregisterUpdate = editor.registerUpdateListener(() => {
    syncDOM();
  });
  const unregisterRoot = kernel.registerRootListener((nextRoot) => {
    rootElement = nextRoot;
    clearDOM();
    if (!rootElement) return;

    selectedKeys.clear();
    readSelectedKeys().forEach((key) => selectedKeys.add(key));
    syncDOM();
  });

  return () => {
    unregisterRoot();
    unregisterUpdate();
    unregisterSelection();
    clearDOM();
    selectedKeys.clear();
    rootElement = null;
  };
};
