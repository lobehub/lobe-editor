import { $wrapNodeInElement } from '@lexical/utils';
import {
  $createParagraphNode,
  $insertNodes,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { $createImageNode } from '../node/image-node';

export const INSERT_IMAGE_COMMAND = createCommand<{ file: File }>('INSERT_IMAGE_COMMAND');

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
      const { file } = payload;
      if (!isImageFile(file)) {
        return false; // Not an image file
      }
      const placeholderURL = URL.createObjectURL(file); // Create a local URL for the image
      editor.update(() => {
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
            console.error('Image upload failed:', error);
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
