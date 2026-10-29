import { $isTableSelection } from '@lexical/table';
import type {
  LexicalEditor,
  SerializedEditorState,
  SerializedElementNode,
  SerializedLexicalNode,
} from 'lexical';
import {
  $getCharacterOffsets,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  IS_CODE,
} from 'lexical';

import { DataSource } from '@/editor-kernel';
import type { IWriteOptions } from '@/editor-kernel/data-source';
import { $normalizeNodeIds, migrateSerializedNodeIds } from '@/plugins/common/node/node-id';

import { cursorNodeSerialized } from '../node/cursor';
import { exportNodeToJSON } from '../utils';

export default class JSONDataSource extends DataSource {
  read(editor: LexicalEditor, data: any, options: Record<string, unknown> = {}) {
    let inputData: SerializedEditorState<SerializedLexicalNode>;
    if (typeof data === 'string') {
      inputData = JSON.parse(data) as SerializedEditorState<SerializedLexicalNode>;
    } else {
      inputData = data as SerializedEditorState<SerializedLexicalNode>;
    }
    const dataObj = structuredClone(inputData) as SerializedEditorState<SerializedLexicalNode> & {
      keepId?: boolean;
    };
    const keepIds = options.keepId ?? dataObj.keepId ?? false;

    if (!keepIds) {
      const stripNodeIds = (node: Record<string, any>) => {
        delete node.id;
        const state = node.$;
        if (state && typeof state === 'object' && state.properties) {
          const properties = { ...state.properties };
          delete properties.nodeId;
          if (Object.keys(properties).length > 0) {
            node.$ = { ...state, properties };
          } else {
            const nextState = { ...state };
            delete nextState.properties;
            if (Object.keys(nextState).length > 0) node.$ = nextState;
            else delete node.$;
          }
        }
        if (Array.isArray(node.children)) {
          node.children.forEach((child: Record<string, any>) => stripNodeIds(child));
        }
      };
      stripNodeIds(dataObj.root as unknown as Record<string, any>);
    } else migrateSerializedNodeIds(dataObj.root);
    const process = (node: SerializedElementNode) => {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if ('children' in child && Array.isArray(child.children)) {
          process(child as SerializedElementNode);
        }
        if (
          child.type === 'text' &&
          'format' in child &&
          typeof child.format === 'number' &&
          (child.format & IS_CODE) > 0
        ) {
          node.children[i] = {
            children: [
              {
                ...child,
                format: child.format & ~IS_CODE,
              } as SerializedLexicalNode,
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'codeInline',
            version: 1,
          } as SerializedElementNode;
          node.children.splice(i + 1, 0, cursorNodeSerialized);
        }
      }
    };
    process(dataObj.root);
    const editorState = editor.parseEditorState({ root: dataObj.root }, () => {
      $normalizeNodeIds($getRoot());
    });
    editor.setEditorState(editorState);
  }

  write(editor: LexicalEditor, options?: IWriteOptions): any {
    if (options?.selection) {
      return editor.getEditorState().read(() => {
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

          const lastElement: Array<
            SerializedElementNode<SerializedLexicalNode> & { $key: string }
          > = [];

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
        return selection.getNodes().map((node) => exportNodeToJSON(node));
      });
    }
    return editor.read(() => ({ root: exportNodeToJSON($getRoot()) }));
  }
}
