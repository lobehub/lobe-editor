import { $wrapNodeInElement } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import {
  $createParagraphNode,
  $getSelection,
  $insertNodes,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_HIGH,
  createCommand,
} from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';
import { IHoleService } from '@/plugins/common/service/i-hole-service';
import { createDebugLogger } from '@/utils/debug';

import { $createBlockFileNode } from '../node/BlockFileNode';
import { $createFileNode } from '../node/FileNode';
import { settleFileUpload } from '../utils';

const logger = createDebugLogger('plugin', 'file');

export const INSERT_FILE_COMMAND = createCommand<{ block?: boolean; file: File }>(
  'INSERT_FILE_COMMAND',
);

export function registerFileCommand(
  editor: LexicalEditor,
  handleUpload: (file: File) => Promise<{ url: string }>,
  defaultBlockFile = false,
) {
  return editor.registerCommand(
    INSERT_FILE_COMMAND,
    (payload) => {
      const { block = defaultBlockFile, file } = payload;
      editor.update(() => {
        const holeService = getKernelFromEditor(editor)?.requireService(IHoleService);
        const currentSelection = $getSelection();
        if (currentSelection) holeService?.prepareBoundaryInsertion(currentSelection);
        const fileNode = block ? $createBlockFileNode(file.name) : $createFileNode(file.name);
        const fileKey = fileNode.getKey();
        $insertNodes([fileNode]); // Insert a zero-width space to ensure the image is not the last child
        if (fileNode.isInline() && $isRootOrShadowRoot(fileNode.getParentOrThrow())) {
          $wrapNodeInElement(fileNode, $createParagraphNode).selectEnd();
        }
        handleUpload(file)
          .then((url) => {
            settleFileUpload(editor, fileKey, (node) => node.setUploaded(url.url));
          })
          .catch((error) => {
            logger.error('❌ File upload failed:', error);
            settleFileUpload(editor, fileKey, (node) =>
              node.setError('File upload failed : ' + error.message),
            );
          });
      });
      return false;
    },
    COMMAND_PRIORITY_HIGH, // Priority
  );
}
