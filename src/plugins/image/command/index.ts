import { $wrapNodeInElement } from '@lexical/utils';
import {
  $createParagraphNode,
  $createRangeSelection,
  $insertNodes,
  $isRootOrShadowRoot,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { createDebugLogger } from '@/utils/debug';

import { $createBlockImageNode } from '../node/block-image-node';
import { $createImageNode } from '../node/image-node';

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
