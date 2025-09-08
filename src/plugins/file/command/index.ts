import { $wrapNodeInElement } from '@lexical/utils';
import {
  $createParagraphNode,
  $insertNodes,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_HIGH,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { createDebugLogger } from '@/utils/debug';

import { $createFileNode } from '../node/FileNode';

const logger = createDebugLogger('plugin', 'file');

export const INSERT_FILE_COMMAND = createCommand<{ file: File }>('INSERT_FILE_COMMAND');

export function registerFileCommand(
  editor: LexicalEditor,
  handleUpload: (file: File) => Promise<{ url: string }>,
) {
  return editor.registerCommand(
    INSERT_FILE_COMMAND,
    (payload) => {
      const { file } = payload;
      editor.update(() => {
        const fileNode = $createFileNode(file.name);
        $insertNodes([fileNode]); // Insert a zero-width space to ensure the image is not the last child
        if ($isRootOrShadowRoot(fileNode.getParentOrThrow())) {
          $wrapNodeInElement(fileNode, $createParagraphNode).selectEnd();
        }
        handleUpload(file)
          .then((url) => {
            editor.update(() => {
              fileNode.setUploaded(url.url);
            });
          })
          .catch((error) => {
            logger.error('❌ File upload failed:', error);
            editor.update(() => {
              fileNode.setError('File upload failed : ' + error.message);
            });
          });
      });
      return false;
    },
    COMMAND_PRIORITY_HIGH, // Priority
  );
}
