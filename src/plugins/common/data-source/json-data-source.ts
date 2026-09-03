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
  resetRandomKey,
} from 'lexical';

import { DataSource } from '@/editor-kernel';
import type { IWriteOptions } from '@/editor-kernel/data-source';
import { INodeHelper } from '@/editor-kernel/inode/helper';
import { $parseSerializedNodeImpl } from '@/plugins/litexml/utils';
import {
  notifyJSONDataSourceRead,
  notifyJSONDataSourceWrite,
} from '@/plugins/properties/service/json-metadata';

import { cursorNodeSerialized } from '../node/cursor';
import { exportNodeToJSON } from '../utils';

type SerializedRecord = SerializedLexicalNode & {
  children?: SerializedLexicalNode[];
};

/**
 * Project runtime-only Hole boundaries out of persisted editor JSON.
 * Cursor nodes outside Hole (for example CodeNode's cursor) are preserved.
 */
export const projectRuntimeHolesForJSON = (node: SerializedRecord): SerializedRecord[] => {
  const children = Array.isArray(node.children) ? node.children : undefined;

  if (node.type === 'hole') {
    const projectedChildren = (children || [])
      .filter((child) => child.type !== 'cursor')
      .flatMap((child) => projectRuntimeHolesForJSON(child as SerializedRecord));

    // Hole is runtime-only, but annotations/provenance may have been attached
    // to its block host. Transfer that state to every projected payload node
    // before dropping the wrapper, otherwise a JSON round-trip silently
    // orphans block comments on Artifact/Hole content.
    const wrapperState = getRecordProperty(node, '$');
    if (!wrapperState) return projectedChildren;

    const wrapperProperties = getRecordProperty(wrapperState, 'properties');
    if (!wrapperProperties && Object.keys(wrapperState).length === 0) {
      return projectedChildren;
    }

    return projectedChildren.map((child) => {
      const childState = getRecordProperty(child, '$') || {};
      const childProperties = getRecordProperty(childState, 'properties');
      const mergedState = { ...wrapperState, ...childState };

      if (wrapperProperties || childProperties) {
        const mergedProperties: Record<string, any> = {};
        if (wrapperProperties) Object.assign(mergedProperties, wrapperProperties);
        if (childProperties) Object.assign(mergedProperties, childProperties);
        const wrapperAnnotationIds = Array.isArray(wrapperProperties?.annotationIds)
          ? wrapperProperties.annotationIds.filter((id): id is string => typeof id === 'string')
          : [];
        const childAnnotationIds = Array.isArray(childProperties?.annotationIds)
          ? childProperties.annotationIds.filter((id): id is string => typeof id === 'string')
          : [];
        const annotationIds = Array.from(new Set([...wrapperAnnotationIds, ...childAnnotationIds]));
        if (annotationIds.length > 0) mergedProperties.annotationIds = annotationIds;
        else delete mergedProperties.annotationIds;
        mergedState.properties = mergedProperties;
      }

      return { ...child, $: mergedState };
    });
  }

  if (!children) return [node];

  return [
    {
      ...node,
      children: children.flatMap((child) => projectRuntimeHolesForJSON(child as SerializedRecord)),
    },
  ];
};

const getRecordProperty = (
  record: SerializedRecord | Record<string, unknown>,
  key: string,
): Record<string, any> | undefined => {
  const value = (record as Record<string, unknown>)[key];
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, any>)
    : undefined;
};

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
    // @ts-expect-error add id option
    if (dataObj.keepId || options.keepId) {
      const state = editor.parseEditorState(
        {
          root: INodeHelper.createRootNode(),
        },
        (state) => {
          try {
            const root = $parseSerializedNodeImpl(dataObj.root, editor, true, state);
            let maxId = -1;
            Array.from(state._nodeMap.keys()).forEach((key) => {
              if (key === 'root') return;
              const numericKey = Number(key);
              if (Number.isInteger(numericKey) && numericKey >= 0) {
                maxId = Math.max(maxId, numericKey);
              }
            });
            // make sure to reset random key to avoid id conflicts
            resetRandomKey(maxId + 1);
            state._nodeMap.set(root.getKey(), root);
          } catch (error) {
            console.error(error);
          }
        },
      );
      editor.setEditorState(state);
    } else {
      editor.setEditorState(editor.parseEditorState({ root: dataObj.root }));
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
        return selection.getNodes().flatMap((node) =>
          projectRuntimeHolesForJSON(exportNodeToJSON(node) as unknown as SerializedRecord),
        );
      });
    }
    return editor.read(() => {
      const runtimeRoot = exportNodeToJSON($getRoot()) as unknown as SerializedRecord;
      const [root] = projectRuntimeHolesForJSON(runtimeRoot);
      notifyJSONDataSourceWrite(editor, root as unknown as Record<string, unknown>);
      return { root };
    });
  }
}
