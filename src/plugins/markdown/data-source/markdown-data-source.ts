/* eslint-disable unicorn/no-for-loop */
import { $isTableSelection } from '@lexical/table';
import type {
  ElementNode,
  LexicalEditor,
  LexicalNode,
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
} from 'lexical';

import { DataSource } from '@/editor-kernel';
import type { IWriteOptions } from '@/editor-kernel/data-source';
import { INodeHelper } from '@/editor-kernel/inode/helper';

import type { MarkdownShortCutService } from '../service/shortcut';
import { logger } from '../utils/logger';
import { MarkdownWriterContext } from './markdown-writer-context';
import { parseMarkdownToLexical } from './markdown/parse';

export default class MarkdownDataSource extends DataSource {
  constructor(
    protected dataType: string,
    protected markdownService: MarkdownShortCutService,
  ) {
    super(dataType);
  }

  read(editor: LexicalEditor, data: string): void {
    const inode = {
      root: parseMarkdownToLexical(data, this.markdownService.markdownReaders),
    };

    logger.debug('Parsed Lexical State:', inode);

    editor.setEditorState(editor.parseEditorState(inode));
  }

  write(editor: LexicalEditor, options?: IWriteOptions): any {
    const processChild = (parentCtx: MarkdownWriterContext, child: LexicalNode) => {
      const writer = this.markdownService.markdownWriters[child.getType()];
      let currentCtx = parentCtx;
      if ($isElementNode(child)) {
        currentCtx = currentCtx.newChild();
      }
      let skipChildren: boolean | undefined = false;
      if (writer) {
        skipChildren = writer(currentCtx, child) as boolean | undefined;
      }
      if (skipChildren) {
        return;
      }
      if ($isElementNode(child)) {
        child.getChildren().forEach((child) => processChild(currentCtx, child));
      }
    };

    if (options?.selection) {
      return editor.read(() => {
        const selection = $getSelection();
        if (!selection) {
          return null;
        }
        const selectedNodes = selection.getNodes();
        if ($isRangeSelection(selection)) {
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

          const rootNode = INodeHelper.createRootNode();
          if (rootNodes.some((node) => INodeHelper.isTextNode(node))) {
            const p = INodeHelper.createParagraph();
            INodeHelper.appendChild(p, ...rootNodes);
            INodeHelper.appendChild(rootNode, p);
          } else {
            INodeHelper.appendChild(rootNode, ...rootNodes);
          }

          const editorState = editor.parseEditorState({ root: rootNode });

          const lexicalRootNode = editorState._nodeMap.get('root') as ElementNode;
          const rootCtx = new MarkdownWriterContext();

          return editorState.read(() => {
            lexicalRootNode.getChildren().forEach((child) => processChild(rootCtx, child));
            return rootCtx.toString();
          });
        } else if ($isTableSelection(selection)) {
          // todo
        }

        const rootNode = INodeHelper.createRootNode();
        if (selectedNodes.some((node) => node.isInline())) {
          const p = INodeHelper.createParagraph();
          INodeHelper.appendChild(p, ...selectedNodes.map((node) => node.exportJSON()));
          INodeHelper.appendChild(rootNode, p);
        } else {
          INodeHelper.appendChild(rootNode, ...selectedNodes.map((node) => node.exportJSON()));
        }

        const editorState = editor.parseEditorState({ root: rootNode });

        const lexicalRootNode = editorState._nodeMap.get('root') as ElementNode;
        const rootCtx = new MarkdownWriterContext();

        return editorState.read(() => {
          lexicalRootNode.getChildren().forEach((child) => processChild(rootCtx, child));
          return rootCtx.toString();
        });
      });
    }
    return editor.getEditorState().read(() => {
      const rootNode = $getRoot();
      const rootCtx = new MarkdownWriterContext();

      rootNode.getChildren().forEach((child) => processChild(rootCtx, child));
      return rootCtx.toString();
    });
  }
}
