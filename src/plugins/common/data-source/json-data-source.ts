import { $isTableSelection } from '@lexical/table';
import type {
  EditorState,
  LexicalEditor,
  LexicalNode,
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
  resetRandomKey,
} from 'lexical';

import { DataSource } from '@/editor-kernel';
import type { IWriteOptions } from '@/editor-kernel/data-source';
import { INodeHelper } from '@/editor-kernel/inode/helper';
import { getKernelFromEditor } from '@/editor-kernel/utils';
import { IHoleService } from '@/plugins/common/service/i-hole-service';
import { $parseSerializedNodeImpl } from '@/plugins/litexml/utils';
import {
  notifyJSONDataSourceRead,
  notifyJSONDataSourceWrite,
} from '@/plugins/properties/service/json-metadata';

import { cursorNodeSerialized } from '../node/cursor';
import { projectRuntimeHolesForJSON, type SerializedRecord } from '../node/hole-serialization';
import { exportNodeToJSON } from '../utils';

const hasNumericSerializedNodeId = (node: unknown): boolean => {
  if (!node || typeof node !== 'object') return false;
  const record = node as { children?: unknown; id?: unknown };
  if (
    (typeof record.id === 'number' || typeof record.id === 'string') &&
    Number.isInteger(Number(record.id)) &&
    Number(record.id) >= 0
  ) {
    return true;
  }
  return Array.isArray(record.children) && record.children.some(hasNumericSerializedNodeId);
};

/** Kept for callers that historically imported the projection from JSONDataSource. */
export { projectRuntimeHolesForJSON } from '../node/hole-serialization';

export default class JSONDataSource extends DataSource {
  read(editor: LexicalEditor, data: any, options: Record<string, unknown> = {}) {
    let dataObj: SerializedEditorState<SerializedLexicalNode>;
    if (typeof data === 'string') {
      dataObj = JSON.parse(data) as SerializedEditorState<SerializedLexicalNode>;
    } else {
      dataObj = data as SerializedEditorState<SerializedLexicalNode>;
    }
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
    notifyJSONDataSourceRead(editor, dataObj.root as unknown as Record<string, unknown>);
    const normalizeIncoming = () => {
      getKernelFromEditor(editor)?.requireService(IHoleService)?.normalizeIncoming();
    };
    // @ts-expect-error add id option
    if (dataObj.keepId || options.keepId) {
      const hasExplicitIds = hasNumericSerializedNodeId(dataObj.root);
      const state = resetRandomKey(() =>
        editor.parseEditorState(
          {
            root: INodeHelper.createRootNode(),
          },
          (state) => {
            let root: LexicalNode | undefined;
            try {
              root = $parseSerializedNodeImpl(dataObj.root, editor, true, state);
            } catch (error) {
              console.error(error);
            }

            if (root) state._nodeMap.set(root.getKey(), root);

            normalizeIncoming();

            if (hasExplicitIds) {
              // Include every node allocated before a malformed child aborted
              // the import. This keeps the scoped allocator above all ids even
              // when the parser reset to a lower explicit id immediately
              // beforehand.
              let maxId = -1;
              Array.from(state._nodeMap.keys()).forEach((key) => {
                if (key === 'root') return;
                const numericKey = Number(key);
                if (Number.isInteger(numericKey) && numericKey >= 0) {
                  maxId = Math.max(maxId, numericKey);
                }
              });
              resetRandomKey(maxId + 1);
            }
          },
        ),
      );
      editor.setEditorState(state);
    } else {
      editor.setEditorState(
        editor.parseEditorState({ root: dataObj.root }, () => {
          normalizeIncoming();
        }),
      );
    }
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

          // Selection exports are public API too. Keep the runtime Hole
          // transparent here just as in full-document writes; otherwise
          // getSelectionDocument('json') leaks boundary Cursor nodes.
          return rootNodes.flatMap((node) =>
            projectRuntimeHolesForJSON(node as unknown as SerializedRecord),
          );
        } else if ($isTableSelection(selection)) {
          // todo
        }
        return selection
          .getNodes()
          .flatMap((node) =>
            projectRuntimeHolesForJSON(exportNodeToJSON(node) as unknown as SerializedRecord),
          );
      });
    }
    // `LexicalEditor.read()` flushes a pending update before entering the
    // read-only scope. JSON export is called from update listeners and may be
    // re-entrant with a pending projection update; flushing there can mutate
    // the update tags/listener queue while Lexical is dispatching it. Read the
    // pending state directly when one exists so callers still observe the
    // latest state without forcing a commit.
    const pendingEditorState = (
      editor as LexicalEditor & {
        _pendingEditorState?: EditorState | null;
      }
    )._pendingEditorState;
    return (pendingEditorState ?? editor.getEditorState()).read(() => {
      const runtimeRoot = exportNodeToJSON($getRoot()) as unknown as SerializedRecord;
      const [root] = projectRuntimeHolesForJSON(runtimeRoot);
      notifyJSONDataSourceWrite(editor, root as unknown as Record<string, unknown>);
      return { root };
    });
  }
}
