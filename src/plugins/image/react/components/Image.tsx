import { COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND } from 'lexical';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react/useLexicalEditor';
import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';

import { $isBlockImageNode, BlockImageNode } from '../../node/block-image-node';
import { ImageNode } from '../../node/image-node';
import BrokenImage from './BrokenImage';
import LazyImage from './LazyImage';
import { useStyles } from './style';

interface ResizeHandleProps {
  isBlock: boolean;
  onResize: (deltaX: number, deltaY: number, position: 'left' | 'right') => void;
  onResizeEnd?: (deltaX: number, deltaY: number) => void;
  position: 'left' | 'right';
}

const ResizeHandle = memo<ResizeHandleProps>(({ onResize, onResizeEnd, position, isBlock }) => {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const rect = isBlock
        ? (e.target as HTMLElement).getBoundingClientRect()
        : {
            height: 0,
            left: 0,
            top: 0,
            width: 0,
          };
      const centerX = rect.left + rect.width / 2;
      let lastDeltaX = 0;
      let lastDeltaY = 0;

      const handleMouseMove = (e: MouseEvent) => {
        let deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Only adjust deltaX based on the resize handle position
        switch (position) {
          case 'left': {
            deltaX = isBlock ? centerX - e.clientX : -deltaX;
            break;
          }
          case 'right': {
            if (isBlock) {
              deltaX = e.clientX - centerX;
            }
            break;
          }
        }

        lastDeltaX = deltaX;
        lastDeltaY = deltaY;
        onResize(deltaX, deltaY, position);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        if (typeof onResizeEnd === 'function') {
          onResizeEnd(lastDeltaX, lastDeltaY);
        }
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [onResize, onResizeEnd, position],
  );

  const getPositionStyle = () => {
    const baseStyle = {
      backgroundColor: '#999999',
      borderRadius: 2,
      cursor: 'col-resize',
      height: '60%',
      opacity: 0.6,
      pointerEvents: 'auto' as const,
      position: 'absolute' as const,
      top: '20%',
      width: 4,
      zIndex: 9999,
    };

    switch (position) {
      case 'left': {
        return { ...baseStyle, left: 20 };
      }
      case 'right': {
        return { ...baseStyle, right: 20 };
      }
    }
  };

  return <div onMouseDown={handleMouseDown} style={getPositionStyle()} />;
});

ResizeHandle.displayName = 'ResizeHandle';

const Image = memo<{ className?: string; node: ImageNode | BlockImageNode }>(
  ({ node, className }) => {
    const { styles, cx } = useStyles();
    const [isSelected, setSelected] = useLexicalNodeSelection(node.getKey());
    const [scale, setScale] = useState(1);
    const [size, setSize] = useState({ height: 0, width: 0 });
    const [newWidth, setNewWidth] = useState<number | null>(null);
    const imageRef = useRef<HTMLDivElement>(null);
    const originalSizeRef = useRef({ height: 0, width: 0 });
    const editorRef = useRef<any>(null);
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
    const handleResize = useCallback(
      (deltaX: number) => {
        if (!originalSizeRef.current.width || !originalSizeRef.current.height) return;

        const aspectRatio = originalSizeRef.current.width / originalSizeRef.current.height;

        const newWidth = Math.max(50, size.width + deltaX);

        // Calculate new height based on the original aspect ratio
        const newHeight = newWidth / aspectRatio;

        setSize({ height: newHeight, width: newWidth });

        setNewWidth(newWidth);

        // Update the scale
        const newScale = newWidth / originalSizeRef.current.width;
        setScale(newScale);
      },
      [size],
    );

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

    const children = useMemo(() => {
      switch (node.status) {
        case 'error': {
          return <BrokenImage />;
        }
        case 'uploaded':
        case 'loading': {
          return (
            <LazyImage
              className={className}
              newWidth={newWidth}
              node={node}
              onLoad={(size) => {
                originalSizeRef.current.width = size.width;
                originalSizeRef.current.height = size.height;
                setSize(size);
              }}
            />
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

        const finalWidth = Math.max(50, size.width + deltaX);

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
      [node, size],
    );

    return (
      <div
        className={cx(styles.imageContainer, { selected: isSelected })}
        draggable={false}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        ref={imageRef}
        style={{
          height: size.height || 'auto',
          width: size.width || 'auto',
        }}
      >
        {children}

        {/* Scale info display */}
        {isSelected && scale !== 1 && (
          <div className={styles.scaleInfo}>{Math.round(scale * 100)}%</div>
        )}

        {/* Resize handles - only left and right */}
        {isSelected && (
          <>
            <ResizeHandle
              isBlock={isBlock}
              onResize={handleResize}
              onResizeEnd={handleResizeEnd}
              position="left"
            />
            <ResizeHandle
              isBlock={isBlock}
              onResize={handleResize}
              onResizeEnd={handleResizeEnd}
              position="right"
            />
          </>
        )}
      </div>
    );
  },
);

Image.displayName = 'Image';

export default Image;
