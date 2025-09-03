/* eslint-disable unicorn/no-for-loop */
import { $isTableSelection } from '@lexical/table';
import {
  $getCharacterOffsets,
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  LexicalEditor,
  SerializedElementNode,
  SerializedLexicalNode,
} from 'lexical';

import { DataSource } from '@/editor-kernel';
import { IWriteOptions } from '@/editor-kernel/data-source';

export default class JSONDataSource extends DataSource {
  read(editor: LexicalEditor, data: any) {
    editor.setEditorState(editor.parseEditorState(data));
  }

  write(editor: LexicalEditor, options?: IWriteOptions): any {
    if (options?.selection) {
      return editor.read(() => {
        const selection = $getSelection();
        if (!selection) {
          return null;
        }
        if ($isRangeSelection(selection)) {
          const selectedNodes = selection.getNodes();
          const selectedNodesLength = selectedNodes.length;
          const lastIndex = selectedNodesLength - 1;
          const anchor = selection.anchor;
          const focus = selection.focus;
          const isBefore = anchor.isBefore(focus);
          const firstNode = selectedNodes[0];
          const lastNode = selectedNodes[lastIndex];
          const [anchorOffset, focusOffset] = $getCharacterOffsets(selection);

          let lastElement: Array<SerializedElementNode<SerializedLexicalNode> & { $key: string }> =
            [];

          const rootNodes: Array<SerializedLexicalNode & { $key: string }> = [];
          for (let i = 0; i < selectedNodes.length; i++) {
            const node = selectedNodes[i];
            if ($isElementNode(node)) {
              const sNode = {
                ...node.exportJSON(),
                $key: node.getKey(),
              };
              for (let i = 0; i < rootNodes.length; i++) {
                const child = rootNodes[i];
                const childNode = $getNodeByKey(child.$key)!;
                if (node.isParentOf(childNode)) {
                  sNode.children.push(child);
                  rootNodes.splice(i, 1);
                  i--;
                }
              }
              let hasPush = false;
              for (let i = lastElement.length - 1; i >= 0; i--) {
                if ($getNodeByKey(lastElement[i].$key)?.isParentOf(node)) {
                  lastElement[i].children.push(sNode);
                  hasPush = true;
                  break;
                } else {
                  lastElement.pop();
                }
              }
              if (!hasPush) {
                rootNodes.push(sNode);
              }
              lastElement.push(sNode);
            } else if ($isTextNode(node)) {
              const sNode = {
                ...node.exportJSON(),
                $key: node.getKey(),
              };
              if (node === firstNode) {
                if (node === lastNode) {
                  if (
                    anchor.type !== 'element' ||
                    focus.type !== 'element' ||
                    focus.offset === anchor.offset
                  ) {
                    sNode.text =
                      anchorOffset < focusOffset
                        ? sNode.text.slice(anchorOffset, focusOffset)
                        : sNode.text.slice(focusOffset, anchorOffset);
                  }
                } else {
                  sNode.text = isBefore
                    ? sNode.text.slice(anchorOffset)
                    : sNode.text.slice(focusOffset);
                }
              } else if (node === lastNode) {
                sNode.text = isBefore
                  ? sNode.text.slice(0, focusOffset)
                  : sNode.text.slice(0, anchorOffset);
              }
              let hasPush = false;
              for (let i = lastElement.length - 1; i >= 0; i--) {
                if ($getNodeByKey(lastElement[i].$key)?.isParentOf(node)) {
                  lastElement[i].children.push(sNode);
                  hasPush = true;
                  break;
                } else {
                  lastElement.pop();
                }
              }
              if (!hasPush) {
                rootNodes.push(sNode);
              }
            } else {
              const sNode = {
                ...node.exportJSON(),
                $key: node.getKey(),
              };
              let hasPush = false;
              for (let i = lastElement.length - 1; i >= 0; i--) {
                if ($getNodeByKey(lastElement[i].$key)?.isParentOf(node)) {
                  lastElement[i].children.push(sNode);
                  hasPush = true;
                  break;
                } else {
                  lastElement.pop();
                }
              }
              if (!hasPush) {
                rootNodes.push(sNode);
              }
            }
          }

          return rootNodes;
        } else if ($isTableSelection(selection)) {
          // todo
        }
        return selection.getNodes().map((node) => node.exportJSON());
      });
    }
    return editor.getEditorState().toJSON();
  }
}
