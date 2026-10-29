import type { LexicalEditor } from 'lexical';
import { type ChangeEvent, useCallback, useRef } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react/useLexicalEditor';
import { createDebugLogger } from '@/utils/debug';

import type { VideoNode } from '../../node/VideoNode';

const logger = createDebugLogger('plugin', 'video');

interface UseVideoSourceOptions {
  handleUpload?: (file: File) => Promise<{ url: string }>;
  node: VideoNode;
  onPickFile?: () => Promise<File | null>;
}

export function useVideoSource({ handleUpload, node, onPickFile }: UseVideoSourceOptions) {
  const editorRef = useRef<LexicalEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useLexicalEditor((editor) => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, []);

  const update = useCallback((fn: () => void) => {
    editorRef.current?.update(fn);
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!handleUpload || !file.type.startsWith('video/')) return;
      update(() => node.setStatus('loading'));
      try {
        const { url } = await handleUpload(file);
        update(() => node.setUploaded(url));
      } catch (error) {
        logger.error('❌ Video upload failed:', error);
        update(() => node.setError((error as Error)?.message || 'Upload failed'));
      }
    },
    [handleUpload, node, update],
  );

  const pickFile = useCallback(async () => {
    if (!onPickFile) {
      fileInputRef.current?.click();
      return;
    }
    const file = await onPickFile();
    if (file) await uploadFile(file);
  }, [onPickFile, uploadFile]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) await uploadFile(file);
    },
    [uploadFile],
  );

  const embed = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      update(() => node.setUploaded(trimmed));
    },
    [node, update],
  );

  return {
    canUpload: !!handleUpload,
    embed,
    fileInputRef,
    handleFileChange,
    pickFile,
    update,
  };
}
