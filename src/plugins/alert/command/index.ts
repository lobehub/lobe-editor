import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import type { LexicalEditor, NodeKey } from 'lexical';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isParagraphNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
} from 'lexical';

import { $createAlertNode, $isAlertNode, type AlertType } from '../node/AlertNode';

export interface InsertAlertPayload {
  alertType?: AlertType;
}

export interface UpdateAlertPayload {
  alertType: AlertType;
  nodeKey: NodeKey;
}

export const INSERT_ALERT_COMMAND = createCommand<InsertAlertPayload | undefined>(
  'INSERT_ALERT_COMMAND',
);

export const UPDATE_ALERT_COMMAND = createCommand<UpdateAlertPayload>('UPDATE_ALERT_COMMAND');

export function registerAlertCommand(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      INSERT_ALERT_COMMAND,
      (payload) => {
        editor.update(() => {
          const alert = $createAlertNode(payload?.alertType);
          const paragraph = $createParagraphNode();
          alert.append(paragraph);

          const selection = $getSelection();
          const anchor = $isRangeSelection(selection) ? selection.anchor.getNode() : null;
          const parentAlert = anchor ? $findMatchingParent(anchor, $isAlertNode) : null;
          const block = anchor
            ? $findMatchingParent(anchor, (node) => {
                const parent = node.getParent();
                return parent !== null && $isRootOrShadowRoot(parent);
              })
            : null;

          if (parentAlert) {
            parentAlert.insertAfter(alert);
          } else if ($isParagraphNode(block) && block.getTextContentSize() === 0) {
            block.replace(alert);
          } else {
            $insertNodes([alert]);
          }
          paragraph.select();
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      UPDATE_ALERT_COMMAND,
      ({ alertType, nodeKey }) => {
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isAlertNode(node)) node.setAlertType(alertType);
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}
