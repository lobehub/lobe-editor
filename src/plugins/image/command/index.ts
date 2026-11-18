import { $wrapNodeInElement } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import {
  $createParagraphNode,
  $createRangeSelection,
  $getNearestNodeFromDOMNode,
  $getSelection,
  $insertNodes,
  $isDecoratorNode,
  $isNodeSelection,
  $isRootOrShadowRoot,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  createCommand,
  DELETE_CHARACTER_COMMAND,
  isDOMNode,
  KEY_ENTER_COMMAND,
} from 'lexical';

import { createDebugLogger } from '@/utils/debug';

import { $createBlockImageNode } from '../node/block-image-node';
import { $createImageNode } from '../node/image-node';
import { $isAnyImageNode } from '../utils/actions';

const logger = createDebugLogger('plugin', 'image');

export const INSERT_IMAGE_COMMAND = createCommand<{
  block?: boolean;
  file: File;
  maxWidth?: number;
  range?: Range | null;
}>('INSERT_IMAGE_COMMAND');

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function registerImageCommand(
  editor: LexicalEditor,
  handleUpload: (file: File) => Promise<{ url: string }>,
  defaultBlockImage: boolean = false,
) {
  return editor.registerCommand(
    INSERT_IMAGE_COMMAND,
    (payload) => {
      const { file, range, block, maxWidth } = payload;
      const isBlock = block ?? defaultBlockImage;
      if (!isImageFile(file)) {
        return false; // Not an image file
      }
      const placeholderURL = URL.createObjectURL(file); // Create a local URL for the image
      editor.update(() => {
        if (range) {
          const rangeSelection = $createRangeSelection();
          if (range !== null && range !== undefined) {
            rangeSelection.applyDOMRange(range);
          }
          $setSelection(rangeSelection);
        }
        const imageNode = isBlock
          ? $createBlockImageNode({
              altText: file.name,
              maxWidth: maxWidth || 800,
              src: placeholderURL,
              status: 'loading',
            })
          : $createImageNode({
              altText: file.name,
              maxWidth: maxWidth || 800,
              src: placeholderURL,
              status: 'loading',
            });
        $insertNodes([imageNode]); // Insert a zero-width space to ensure the image is not the last child
        if (!isBlock && $isRootOrShadowRoot(imageNode.getParentOrThrow())) {
          $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd();
        }
        handleUpload(file)
          .then((res) => {
            editor.update(() => {
              imageNode.setUploaded(res.url);
            });
          })
          .catch((error) => {
            logger.error('❌ Image upload failed:', error);
            editor.update(() => {
              imageNode.setError('Image upload failed : ' + error.message);
            });
          });
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR, // Priority
  );
}

/**
 * Pressing Enter while one or more images are selected (node selection)
 * deletes them, through the same DELETE_CHARACTER_COMMAND path Backspace uses.
 * Enter in a range selection, or inside an input rendered by a decorator
 * (e.g. the image caption), keeps its default behaviour.
 */
export function registerImageEnterDelete(editor: LexicalEditor) {
  return editor.registerCommand(
    KEY_ENTER_COMMAND,
    (event) => {
      const target = event?.target;
      if (isDOMNode(target) && $isDecoratorNode($getNearestNodeFromDOMNode(target))) {
        return false;
      }

      const selection = $getSelection();
      if (!$isNodeSelection(selection)) return false;

      const nodes = selection.getNodes();
      if (nodes.length === 0 || !nodes.every((node) => $isAnyImageNode(node))) return false;

      event?.preventDefault();
      return editor.dispatchCommand(DELETE_CHARACTER_COMMAND, true);
    },
    COMMAND_PRIORITY_LOW,
  );
}
