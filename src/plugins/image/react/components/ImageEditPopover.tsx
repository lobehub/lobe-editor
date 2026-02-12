import { Button, Flexbox, Icon, Input, Popover } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { LinkIcon, UploadIcon } from 'lucide-react';
import {
  type ChangeEvent,
  type FC,
  type ReactNode,
  memo,
  useCallback,
  useRef,
  useState,
} from 'react';

import { useEditable } from '@/editor-kernel/react/useEditable';
import { useLexicalEditor } from '@/editor-kernel/react/useLexicalEditor';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { BlockImageNode } from '../../node/block-image-node';
import { ImageNode } from '../../node/image-node';

interface ImageEditPopoverProps {
  children: ReactNode;
  handleUpload?: (file: File) => Promise<{ url: string }>;
  node: ImageNode | BlockImageNode;
  /**
   * Custom file picker for environments where programmatic input.click() is blocked (e.g. Electron).
   * When provided, this will be called instead of triggering the hidden file input.
   */
  onPickFile?: () => Promise<File | null>;
}

const ImageEditPopover: FC<ImageEditPopoverProps> = memo(
  ({ children, node, handleUpload, onPickFile }) => {
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<any>(null);
    const { editable } = useEditable();
    const t = useTranslation();

    useLexicalEditor((editor) => {
      editorRef.current = editor;
      return () => {
        editorRef.current = null;
      };
    }, []);

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (nextOpen && node.status !== 'uploaded') return;
        if (nextOpen) setUrl(node.src);
        setOpen(nextOpen);
      },
      [node],
    );

    const handleClose = useCallback(() => {
      setOpen(false);
    }, []);

    const handleUrlSubmit = useCallback(() => {
      const editor = editorRef.current;
      if (!editor || !url.trim()) return;
      const trimmedUrl = url.trim();
      handleClose();
      editor.update(() => {
        node.setUploaded(trimmedUrl);
      });
    }, [node, url, handleClose]);

    const handleFileChange = useCallback(
      async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !handleUpload) return;

        handleClose();
        setUploading(true);

        try {
          const editor = editorRef.current;
          if (!editor) return;
          editor.update(() => {
            node.setStatus('loading');
          });
          const result = await handleUpload(file);
          editor.update(() => {
            node.setUploaded(result.url);
          });
        } catch {
          const editor = editorRef.current;
          if (editor) {
            editor.update(() => {
              node.setError('Upload failed');
            });
          }
        } finally {
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      [node, handleUpload, handleClose],
    );

    const handlePickFile = useCallback(async () => {
      if (onPickFile) {
        const file = await onPickFile();
        if (file && handleUpload) {
          handleClose();
          setUploading(true);
          try {
            const editor = editorRef.current;
            if (!editor) return;
            editor.update(() => {
              node.setStatus('loading');
            });
            const result = await handleUpload(file);
            editor.update(() => {
              node.setUploaded(result.url);
            });
          } catch {
            const editor = editorRef.current;
            if (editor) {
              editor.update(() => {
                node.setError('Upload failed');
              });
            }
          } finally {
            setUploading(false);
          }
        }
      } else {
        fileInputRef.current?.click();
      }
    }, [onPickFile, handleUpload, handleClose, node]);

    const content = (
      <Flexbox gap={8} style={{ width: 320 }}>
        <Input
          onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleUrlSubmit();
            if (e.key === 'Escape') handleClose();
          }}
          placeholder="https://..."
          prefix={<Icon color={cssVar.colorTextDescription} icon={LinkIcon} />}
          value={url}
        />
        <Flexbox gap={8} horizontal justify="flex-end">
          {handleUpload && (
            <>
              {!onPickFile && (
                <input
                  accept="image/*"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  type="file"
                />
              )}
              <Button
                icon={<Icon icon={UploadIcon} />}
                loading={uploading}
                onClick={handlePickFile}
                size="small"
                type="text"
              >
                {t('image.replace')}
              </Button>
            </>
          )}
          <Button onClick={handleUrlSubmit} size="small" type="text" variant="filled">
            {t('confirm')}
          </Button>
        </Flexbox>
      </Flexbox>
    );

    return (
      <Popover
        arrow={false}
        content={content}
        disabled={!editable || node.status !== 'uploaded'}
        onOpenChange={handleOpenChange}
        open={open}
        placement="bottom"
        styles={{
          content: {
            padding: 12,
          },
        }}
        trigger="click"
      >
        {children}
      </Popover>
    );
  },
);

ImageEditPopover.displayName = 'ImageEditPopover';

export default ImageEditPopover;
