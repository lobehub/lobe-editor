import {
  $createParagraphNode,
  $getNodeByKey,
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  createCommand,
} from 'lexical';

import { $createCollapsibleNode, $isCollapsibleNode } from '../node/CollapsibleNode';

export interface InsertCollapsiblePayload {
  children?: LexicalNode[];
  collapsed?: boolean;
  title?: string;
}

export interface UpdateCollapsiblePayload {
  collapsed?: boolean;
  nodeKey: NodeKey;
  title?: string;
}

export const INSERT_COLLAPSIBLE_COMMAND = createCommand<InsertCollapsiblePayload | undefined>(
  'INSERT_COLLAPSIBLE_COMMAND',
);
export const UPDATE_COLLAPSIBLE_COMMAND = createCommand<UpdateCollapsiblePayload>(
  'UPDATE_COLLAPSIBLE_COMMAND',
);

export function registerCollapsibleCommand(editor: LexicalEditor) {
  const unregisterInsert = editor.registerCommand(
    INSERT_COLLAPSIBLE_COMMAND,
    (payload = {}) => {
      editor.update(() => {
        const collapsibleNode = $createCollapsibleNode(
          payload.title || 'Details',
          Boolean(payload.collapsed),
        );
        collapsibleNode.append(
          ...(payload.children?.length ? payload.children : [$createParagraphNode()]),
        );
        $insertNodes([collapsibleNode]);
        collapsibleNode.selectStart();
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );

  const unregisterUpdate = editor.registerCommand(
    UPDATE_COLLAPSIBLE_COMMAND,
    ({ collapsed, nodeKey, title }) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (!$isCollapsibleNode(node)) return;

        if (title !== undefined) {
          node.setTitle(title);
        }
        if (collapsed !== undefined) {
          node.setCollapsed(collapsed);
        }
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );

  return () => {
    unregisterInsert();
    unregisterUpdate();
  };
}
