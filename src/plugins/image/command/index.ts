import { $wrapNodeInElement } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import {
  $createNodeSelection,
  $createParagraphNode,
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRootOrShadowRoot,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
} from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';
import {
  createEditorAsyncScope,
  type IEditorAsyncScope,
} from '@/plugins/common/service/editor-async-scope';
import { IHoleService } from '@/plugins/common/service/i-hole-service';
import { $ensureNodeId } from '@/plugins/properties/utils';
import { createDebugLogger } from '@/utils/debug';

import { $createBlockImageNode } from '../node/block-image-node';
import { $createImageNode } from '../node/image-node';
import { settleImageNode } from '../utils';

const logger = createDebugLogger('plugin', 'image');

export const INSERT_IMAGE_COMMAND = createCommand<{
  block?: boolean;
  file: File;
  maxWidth?: number;
  range?: Range | null;
}>('INSERT_IMAGE_COMMAND');

export const INSERT_BLOCK_IMAGE_COMMAND = createCommand<{
  altText?: string;
  height?: number;
  maxWidth?: number;
  onInserted?: (nodeId: string) => void;
  src?: string;
  width?: number;
}>('INSERT_BLOCK_IMAGE_COMMAND');

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function registerImageCommand(
  editor: LexicalEditor,
  handleUpload: (file: File) => Promise<{ url: string }>,
  defaultBlockImage: boolean = false,
  scope?: IEditorAsyncScope,
) {
  const uploadScope = scope ?? createEditorAsyncScope(editor);
  const ownsScope = !scope;
  const unregister = editor.registerCommand(
    INSERT_IMAGE_COMMAND,
    (payload) => {
      if (!uploadScope.isActive()) return false;
      const { file, range, block, maxWidth } = payload;
      const isBlock = block ?? defaultBlockImage;
      if (!isImageFile(file)) {
        return false; // Not an image file
      }
      const placeholderURL = URL.createObjectURL(file); // Create a local URL for the image
      editor.update(() => {
        if (!uploadScope.isActive()) return;
        if (range) {
          const rangeSelection = $createRangeSelection();
          if (range !== null && range !== undefined) {
            rangeSelection.applyDOMRange(range);
          }
          $setSelection(rangeSelection);
        }
        const currentSelection = $getSelection();
        const holeService = getKernelFromEditor(editor)?.requireService(IHoleService);
        if (currentSelection) holeService?.prepareBoundaryInsertion(currentSelection);
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
        const imageKey = imageNode.getKey();
        const imageType = imageNode.getType();
        handleUpload(file)
          .then((res) => {
            settleImageNode(uploadScope, imageKey, imageType, (node) => node.setUploaded(res.url));
          })
          .catch((error) => {
            logger.error('❌ Image upload failed:', error);
            settleImageNode(uploadScope, imageKey, imageType, (node) =>
              node.setError('Image upload failed : ' + error.message),
            );
          });
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR, // Priority
  );

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    if (ownsScope) uploadScope.dispose();
    unregister();
  };
}

export function registerBlockImageCommand(editor: LexicalEditor) {
  return editor.registerCommand(
    INSERT_BLOCK_IMAGE_COMMAND,
    (payload) => {
      const holeService = getKernelFromEditor(editor)?.requireService(IHoleService);
      const currentSelection = $getSelection();
      if (currentSelection) holeService?.prepareBoundaryInsertion(currentSelection);
      const src = payload?.src?.trim() ?? '';
      const image = $createBlockImageNode({
        altText: payload?.altText ?? '',
        height: payload?.height,
        maxWidth: payload?.maxWidth ?? 800,
        src,
        status: src ? 'uploaded' : 'loading',
        width: payload?.width,
      });
      if (!$getSelection()) {
        const paragraph = $createParagraphNode();
        $getRoot().append(paragraph);
        paragraph.selectEnd();
      }
      $insertNodes([image]);
      const nodeId = $ensureNodeId(image);
      const selection = $createNodeSelection();
      selection.add(image.getKey());
      $setSelection(selection);
      if (nodeId && payload?.onInserted) {
        editor.update(() => undefined, {
          discrete: true,
          onUpdate: () => payload.onInserted?.(nodeId),
        });
      }
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );
}
