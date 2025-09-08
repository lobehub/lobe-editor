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

import { $createImageNode } from '../node/image-node';

const logger = createDebugLogger('plugin', 'image');

export const INSERT_IMAGE_COMMAND = createCommand<{ file: File; range?: Range | null }>(
  'INSERT_IMAGE_COMMAND',
);

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function registerImageCommand(
  editor: LexicalEditor,
  handleUpload: (file: File) => Promise<{ url: string }>,
) {
  return editor.registerCommand(
    INSERT_IMAGE_COMMAND,
    (payload) => {
      const { file, range } = payload;
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
        const imageNode = $createImageNode({
          altText: file.name,
          src: placeholderURL,
        });
        $insertNodes([imageNode]); // Insert a zero-width space to ensure the image is not the last child
        if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
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
