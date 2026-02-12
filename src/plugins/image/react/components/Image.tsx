import { Icon } from '@lobehub/ui';
import { cx } from 'antd-style';
import { COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND } from 'lexical';
import { LoaderCircleIcon } from 'lucide-react';
import React, { Suspense, memo, useCallback, useMemo, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react/useLexicalEditor';
import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';

import { $isBlockImageNode, BlockImageNode } from '../../node/block-image-node';
import { ImageNode } from '../../node/image-node';
import BrokenImage from './BrokenImage';
import ImageEditPopover from './ImageEditPopover';
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

const Image = memo<ImageProps>(
  ({ node, className, showScaleInfo = false, handleUpload, onPickFile }) => {
    const [isSelected, setSelected] = useLexicalNodeSelection(node.getKey());
    const [isHovered, setIsHovered] = useState(false);
    const [scale, setScale] = useState(1);
    const [size, setSize] = useState({ height: 0, width: 0 });
    const [newWidth, setNewWidth] = useState<number | null>(null);
    const imageRef = useRef<HTMLDivElement>(null);
    const originalSizeRef = useRef({ height: 0, width: 0 });
    const editorRef = useRef<any>(null);
    const startWidthRef = useRef<number>(0);
    const lastLoadedSrcRef = useRef<string | null>(null);
    const isBlock = useMemo(() => {
      return $isBlockImageNode(node);
    }, [node]);

    useLexicalEditor((editor) => {
      editorRef.current = editor;
      const unregister = editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    // Resize by dragging - only control width; height is calculated by aspect ratio
    const handleResize = useCallback((deltaX: number) => {
      if (!originalSizeRef.current.width || !originalSizeRef.current.height) return;
      if (!imageRef.current) return;

      const aspectRatio = originalSizeRef.current.width / originalSizeRef.current.height;

      // Get parent container width to limit max width
      const parentWidth = imageRef.current.parentElement?.clientWidth || window.innerWidth;
      const maxWidth = parentWidth;

      // Since image is centered, delta is halved (both sides resize)
      const adjustedDeltaX = deltaX * 2;

      // Use the width captured at mousedown time
      const newWidth = Math.max(50, Math.min(startWidthRef.current + adjustedDeltaX, maxWidth));

      // Calculate new height based on the original aspect ratio
      const newHeight = newWidth / aspectRatio;

      setSize({ height: newHeight, width: newWidth });

      setNewWidth(newWidth);

      // Update the scale
      const newScale = newWidth / originalSizeRef.current.width;
      setScale(newScale);
    }, []);

    // Store the initial width when resize starts
    const handleResizeStart = useCallback((initialWidth: number) => {
      startWidthRef.current = initialWidth;
    }, []);

    // Click to select
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelected(true);
      },
      [setSelected],
    );

    // Double-click to reset to original size and aspect ratio
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
          node.setWidth(orig.width);
          node.setMaxWidth(orig.width);
        } catch {
          // ignore errors silently
        }
      });
    }, []);

    // Mouse enter handler
    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
    }, []);

    // Mouse leave handler
    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
    }, []);

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
          ) : null;

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
                  setSize(loadedSize);
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

    // On resize end, persist to node (set maxWidth)
    const handleResizeEnd = useCallback(
      (deltaX: number) => {
        if (!originalSizeRef.current.width || !originalSizeRef.current.height) return;
        if (!imageRef.current) return;

        // Get parent container width to limit max width
        const parentWidth = imageRef.current.parentElement?.clientWidth || window.innerWidth;
        const maxWidth = parentWidth;

        // Since image is centered, delta is halved (both sides resize)
        const adjustedDeltaX = deltaX / 2;

        // Use the width captured at mousedown time
        const finalWidth = Math.max(50, Math.min(startWidthRef.current + adjustedDeltaX, maxWidth));

        // persist to node via editor.update
        const editor = editorRef.current;
        if (!editor) return;
        editor.update(() => {
          try {
            node.setWidth(finalWidth);
            node.setMaxWidth(finalWidth);
          } catch {
            // ignore errors silently
          }
        });
      },
      [node],
    );

    return (
      <ImageEditPopover handleUpload={handleUpload} node={node} onPickFile={onPickFile}>
        <div
          className={cx(styles.imageContainer, {
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
            width: size.width || 'auto',
          }}
        >
          {children}

          {node.status === 'loading' && (
            <div className={styles.loadingIcon}>
              <Icon icon={LoaderCircleIcon} size={24} spin />
            </div>
          )}

          {/* Scale info display */}
          {showScaleInfo && isSelected && scale !== 1 && (
            <div className={styles.scaleInfo}>{Math.round(scale * 100)}%</div>
          )}

          {/* Resize handles - only left and right */}
          {isHovered && node.status === 'uploaded' && (
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
    );
  },
);

Image.displayName = 'Image';

export default Image;
