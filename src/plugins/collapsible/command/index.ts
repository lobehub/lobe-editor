/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  createCommand,
} from 'lexical';

import {
  $createCollapsibleNode,
  $isCollapsibleNode,
  type CollapsibleNode,
} from '../node/CollapsibleNode';

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
        const payloadChildren = payload.children;
        const hasPayloadChildren = Boolean(payloadChildren?.length);
        const title = payload.title ?? (hasPayloadChildren ? 'Details' : '');
        const collapsibleNode = $createCollapsibleNode(
          title,
          Boolean(payload.collapsed),
        );
        let children: LexicalNode[];
        if (payloadChildren?.length) {
          children = ensureTitleChild(payloadChildren, title);
        } else {
          const titleChild = $createParagraphNode();
          if (title) {
            titleChild.append($createTextNode(title));
          }
          children = [titleChild, $createParagraphNode()];
        }
        collapsibleNode.append(...children);

        const parentCollapsible = $getSelectedCollapsibleAncestor();
        if (parentCollapsible) {
          parentCollapsible.insertAfter(collapsibleNode);
        } else {
          $insertNodes([collapsibleNode]);
        }
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
          updateTitleChild(node, title);
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

function $getSelectedCollapsibleAncestor(): CollapsibleNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;

  let current: LexicalNode | null = selection.anchor.getNode();
  while (current) {
    if ($isCollapsibleNode(current)) return current;
    current = current.getParent();
  }

  return null;
}

function $createTitleParagraph(title: string) {
  const paragraph = $createParagraphNode();
  paragraph.append($createTextNode(title));
  return paragraph;
}

function ensureTitleChild(children: LexicalNode[], title: string): LexicalNode[] {
  if (!title) return children;
  const firstChild = children[0];
  if (firstChild?.getTextContent().trim() === title.trim()) {
    return children;
  }
  return [$createTitleParagraph(title), ...children];
}

function updateTitleChild(node: CollapsibleNode, title: string) {
  const titleParagraph = $createTitleParagraph(title);
  const firstChild = node.getFirstChild();
  if (firstChild) {
    firstChild.replace(titleParagraph);
  } else {
    node.append(titleParagraph);
  }
}
