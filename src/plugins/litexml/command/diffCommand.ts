import { mergeRegister } from '@lexical/utils';
import {
  $getNodeByKey,
  $isElementNode,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { DiffNode } from '../node/DiffNode';

export enum DiffAction {
  Reject,
  Accept,
}

export const LITEXML_DIFFNODE_COMMAND = createCommand<{ action: DiffAction; nodeKey: string }>(
  'LITEXML_DIFFNODE_COMMAND',
);

export const LITEXML_DIFFNODE_ALL_COMMAND = createCommand<{ action: DiffAction }>(
  'LITEXML_DIFFNODE_ALL_COMMAND',
);

function doAction(node: DiffNode, action: DiffAction) {
  if (node.diffType === 'modify') {
    const children = node.getChildren();
    if (action === DiffAction.Accept) {
      node.replace(children[1], false).selectEnd();
    } else if (action === DiffAction.Reject) {
      node.replace(children[0], false).selectEnd();
    }
  }
  if (node.diffType === 'remove') {
    if (action === DiffAction.Accept) {
      node.remove();
    } else if (action === DiffAction.Reject) {
      const children = node.getChildren();
      node.replace(children[0], false).selectEnd();
    }
  }
  if (node.diffType === 'add') {
    if (action === DiffAction.Accept) {
      const children = node.getChildren();
      node.replace(children[0], false).selectEnd();
    } else if (action === DiffAction.Reject) {
      node.remove();
    }
  }
  if (node.diffType === 'listItemModify') {
    const children = node.getChildren();
    if (action === DiffAction.Accept) {
      const lastChild = children[1];
      if (!$isElementNode(lastChild)) {
        throw new Error('Expected element node as child of DiffNode');
      }
      const nodeChildrens = lastChild.getChildren();
      for (let i = nodeChildrens.length - 1; i >= 0; i--) {
        node.insertAfter(nodeChildrens[i]);
      }
      const parent = node.getParentOrThrow();
      node.remove();
      parent.selectEnd();
    } else if (action === DiffAction.Reject) {
      const firstChild = children[0];
      if (!$isElementNode(firstChild)) {
        throw new Error('Expected element node as child of DiffNode');
      }
      const nodeChildrens = firstChild.getChildren();
      for (let i = nodeChildrens.length - 1; i >= 0; i--) {
        node.insertAfter(nodeChildrens[i]);
      }
      const parent = node.getParentOrThrow();
      node.remove();
      parent.selectEnd();
    }
  }
}

export function registerLiteXMLDiffCommand(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      LITEXML_DIFFNODE_COMMAND,
      (payload) => {
        const { action, nodeKey } = payload;
        const node = editor.getEditorState().read(() => {
          return $getNodeByKey(nodeKey) as DiffNode | null;
        });
        if (!node) {
          return false;
        }
        editor.update(() => {
          doAction(node, action);
        });

        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      LITEXML_DIFFNODE_ALL_COMMAND,
      (payload) => {
        const { action } = payload;
        const nodes = editor.getEditorState().read(() => {
          return Array.from(editor._editorState._nodeMap.values()).filter(
            (n) => n instanceof DiffNode && !!n.getParent(),
          ) as DiffNode[];
        });
        if (!nodes.length) {
          return false;
        }
        editor.update(() => {
          nodes.forEach((node) => {
            doAction(node, action);
          });
        });

        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}
