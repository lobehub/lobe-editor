import { ActionIcon, cx, Icon, useImagePreview } from '@lobehub/ui';
import { COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND } from 'lexical';
import { LoaderCircleIcon, ZoomInIcon } from 'lucide-react';
import React, { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useEditable } from '@/editor-kernel/react/useEditable';
import { useLexicalEditor } from '@/editor-kernel/react/useLexicalEditor';
import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { mediaDisplaySizeAfterResize } from '@/utils/mediaDisplaySize';

import type { BlockImageNode } from '../../node/block-image-node';
import { $isBlockImageNode } from '../../node/block-image-node';
import type { ImageNode } from '../../node/image-node';
import { getImageDisplaySize } from '../../utils/displaySize';
import BrokenImage from './BrokenImage';
import ImageCaption from './ImageCaption';
import ImageEditPopover from './ImageEditPopover';
import ImagePlaceholder from './ImagePlaceholder';
import LazyImage from './LazyImage';
import { ResizeHandle } from './ResizeHandle';
import { styles } from './style';

export interface ImageProps {
  className?: string;
  handleUpload?: (file: File) => Promise<{ url: string }>;
  node: ImageNode | BlockImageNode;
  onPickFile?: () => Promise<File | null>;
  /** Whether to show scale info when resizing. Defaults to false */
  showScaleInfo?: boolean;
}

function getResizedImageWidth(startWidth: number, deltaX: number, maxWidth: number) {
  const adjustedDeltaX = deltaX * 2;

  return Math.max(50, Math.min(startWidth + adjustedDeltaX, maxWidth));
}

const Image = memo<ImageProps>(
  ({ node, className, showScaleInfo = false, handleUpload, onPickFile }) => {
    const [isSelected, setSelected] = useLexicalNodeSelection(node.getKey());
    const [isHovered, setIsHovered] = useState(false);
    const [scale, setScale] = useState(1);
    const [size, setSize] = useState({ height: 0, width: 0 });
    const [newWidth, setNewWidth] = useState<number | null>(null);
    const imageRef = useRef<HTMLDivElement>(null);
    const originalSizeRef = useRef({ height: 0, width: 0 });
    const naturalWidthRef = useRef(0);
    const editorRef = useRef<any>(null);
    const startWidthRef = useRef<number>(0);
    const lastLoadedSrcRef = useRef<string | null>(null);
    const previewImageRef = useRef<HTMLImageElement | null>(null);
    const { open: openPreview, outlet: previewOutlet } = useImagePreview(previewImageRef);
    const t = useTranslation();
    const { editable } = useEditable();
    const isBlock = useMemo(() => {
      return $isBlockImageNode(node);
    }, [node]);
    const display = getImageDisplaySize(node);

    useEffect(() => {
      setNewWidth(null);
    }, [node.displayWidth, node.width]);

    const getMetrics = useCallback(
      () => ({
        containerWidth: imageRef.current?.parentElement?.clientWidth || undefined,
        naturalWidth: naturalWidthRef.current || originalSizeRef.current.width || undefined,
      }),
      [],
    );

    useLexicalEditor((editor) => {
      editorRef.current = editor;
      const unregister = editor.registerCommand(
        SELECTION_CHANGE_COMMAND,

        (_, _activeEditor) => {
          return false;
        },
        COMMAND_PRIORITY_LOW,
      );
      return () => {
        editorRef.current = null;
        unregister();
      };
    }, []);

    const handleResize = useCallback((deltaX: number) => {
      if (!originalSizeRef.current.width || !originalSizeRef.current.height) return;
      if (!imageRef.current) return;

      const aspectRatio = originalSizeRef.current.width / originalSizeRef.current.height;

      const parentWidth = imageRef.current.parentElement?.clientWidth || window.innerWidth;
      const maxWidth = parentWidth;

      const newWidth = getResizedImageWidth(startWidthRef.current, deltaX, maxWidth);

      const newHeight = newWidth / aspectRatio;

      setSize({ height: newHeight, width: newWidth });

      setNewWidth(newWidth);

      const newScale = newWidth / originalSizeRef.current.width;
      setScale(newScale);
    }, []);

    const handleResizeStart = useCallback((initialWidth: number) => {
      startWidthRef.current = initialWidth;
    }, []);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
      const editor = editorRef.current;
      if (!editor) return;
      e.stopPropagation();
      e.preventDefault();
      const orig = originalSizeRef.current;
      if (!orig.width || !orig.height) return;
      setSize(orig);
      setScale(1);
      setNewWidth(orig.width);
      editor.update(() => {
        try {
          node.setDisplaySize({ mode: 'px', px: orig.width });
        } catch {
          // ignore errors silently
        }
      });
    }, []);

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
    }, []);

    const handlePreview = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        previewImageRef.current = imageRef.current?.querySelector('img') ?? null;
        openPreview();
      },
      [openPreview],
    );

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        if (!editable) {
          if (node.status === 'uploaded') handlePreview(e);
          return;
        }
        e.stopPropagation();
        setSelected(true);
      },
      [editable, handlePreview, node.status, setSelected],
    );

    const children = useMemo(() => {
      switch (node.status) {
        case 'error': {
          return <BrokenImage />;
        }
        case 'uploaded':
        case 'loading': {
          const fallback = lastLoadedSrcRef.current ? (
            <img
              alt={node.altText}
              className={cx(styles.lazyImage, className || undefined)}
              draggable="false"
              src={lastLoadedSrcRef.current}
              style={{ width: '100%' }}
            />
          ) : (
            <ImagePlaceholder newWidth={newWidth} node={node} />
          );

          return (
            <Suspense fallback={fallback}>
              <LazyImage
                className={className}
                newWidth={newWidth}
                node={node}
                onLoad={(loadedSize) => {
                  lastLoadedSrcRef.current = node.src;
                  originalSizeRef.current.width = loadedSize.width;
                  originalSizeRef.current.height = loadedSize.height;
                  naturalWidthRef.current = loadedSize.naturalWidth;
                  setSize({ height: loadedSize.height, width: loadedSize.width });
                }}
              />
            </Suspense>
          );
        }
        default: {
          return null;
        }
      }
    }, [node.status, className, node, newWidth]);

    const handleResizeEnd = useCallback(
      (deltaX: number) => {
        if (!originalSizeRef.current.width || !originalSizeRef.current.height) return;
        if (!imageRef.current) return;

        const parentWidth = imageRef.current.parentElement?.clientWidth || window.innerWidth;
        const maxWidth = parentWidth;

        const finalWidth = getResizedImageWidth(startWidthRef.current, deltaX, maxWidth);

        const editor = editorRef.current;
        if (!editor) return;
        const nextSize = mediaDisplaySizeAfterResize(
          getImageDisplaySize(node).mode,
          finalWidth,
          parentWidth,
        );
        editor.update(() => {
          try {
            node.setDisplaySize(nextSize);
          } catch {
            // ignore errors silently
          }
        });
      },
      [node],
    );

    return (
      <>
        <ImageEditPopover
          getMetrics={getMetrics}
          handleUpload={handleUpload}
          node={node}
          onPickFile={onPickFile}
        >
          <div
            className={cx(styles.imageContainer, !editable && styles.readonly, {
              loading: node.status === 'loading',
              selected: isSelected,
            })}
            draggable={false}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            ref={imageRef}
            style={{
              width:
                newWidth === null && display.mode === 'percent'
                  ? `${display.value}%`
                  : newWidth === null && display.mode === 'px'
                    ? `min(${display.px}px, 100%)`
                    : size.width || 'auto',
            }}
          >
            {children}

            {node.status === 'loading' && (
              <div className={styles.loadingIcon}>
                <Icon icon={LoaderCircleIcon} size={24} spin />
              </div>
            )}

            {(isHovered || isSelected) && node.status === 'uploaded' && (
              <ActionIcon
                aria-label={t('image.preview')}
                glass
                className={styles.previewAction}
                icon={ZoomInIcon}
                onClick={handlePreview}
                size="small"
                title={t('image.preview')}
                variant="filled"
              />
            )}

            {previewOutlet}

            {showScaleInfo && isSelected && scale !== 1 && (
              <div className={styles.scaleInfo}>{Math.round(scale * 100)}%</div>
            )}

            {editable && isHovered && node.status === 'uploaded' && (
              <>
                <ResizeHandle
                  imageRef={imageRef}
                  isBlock={isBlock}
                  onResize={handleResize}
                  onResizeEnd={handleResizeEnd}
                  onResizeStart={handleResizeStart}
                  position="left"
                />
                <ResizeHandle
                  imageRef={imageRef}
                  isBlock={isBlock}
                  onResize={handleResize}
                  onResizeEnd={handleResizeEnd}
                  onResizeStart={handleResizeStart}
                  position="right"
                />
              </>
            )}
          </div>
        </ImageEditPopover>
        {$isBlockImageNode(node) && <ImageCaption active={isSelected} node={node} />}
      </>
    );
  },
);

Image.displayName = 'Image';

export default Image;
