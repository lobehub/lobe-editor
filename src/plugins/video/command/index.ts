import type { LexicalEditor } from 'lexical';
import {
  $createRangeSelection,
  $insertNodes,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
} from 'lexical';

import { createDebugLogger } from '@/utils/debug';

import { $createVideoNode } from '../node/VideoNode';

const logger = createDebugLogger('plugin', 'video');

export interface InsertVideoPayload {
  file?: File;
  poster?: string;
  range?: Range | null;
  src?: string;
}

export const INSERT_VIDEO_COMMAND = createCommand<InsertVideoPayload>('INSERT_VIDEO_COMMAND');

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

export function registerVideoCommand(
  editor: LexicalEditor,
  handleUpload?: (file: File) => Promise<{ url: string }>,
) {
  return editor.registerCommand(
    INSERT_VIDEO_COMMAND,
    (payload) => {
      const { file, poster, range, src } = payload;
      if (file && (!isVideoFile(file) || !handleUpload)) return false;

      editor.update(() => {
        if (range) {
          const rangeSelection = $createRangeSelection();
          rangeSelection.applyDOMRange(range);
          $setSelection(rangeSelection);
        }
        const videoNode = $createVideoNode({
          poster,
          src: file ? '' : src,
          status: file ? 'loading' : 'uploaded',
        });
        $insertNodes([videoNode]);

        if (!file || !handleUpload) return;
        handleUpload(file)
          .then((res) => {
            editor.update(() => {
              videoNode.setUploaded(res.url);
            });
          })
          .catch((error) => {
            logger.error('❌ Video upload failed:', error);
            editor.update(() => {
              videoNode.setError(`Video upload failed : ${error.message}`);
            });
          });
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );
}
