import { COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND } from 'lexical';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react/useLexicalEditor';
import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';

import { ImageNode } from '../../node/image-node';
import BrokenImage from './BrokenImage';
import LazyImage from './LazyImage';
import { useStyles } from './style';

interface ResizeHandleProps {
  onResize: (deltaX: number, deltaY: number) => void;
  onResizeEnd?: (deltaX: number, deltaY: number) => void;
  position: 'nw' | 'ne' | 'sw' | 'se';
}

const ResizeHandle = memo<ResizeHandleProps>(({ onResize, onResizeEnd, position }) => {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      let lastDeltaX = 0;
      let lastDeltaY = 0;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        lastDeltaX = deltaX;
        lastDeltaY = deltaY;
        onResize(deltaX, deltaY);
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
    [onResize, onResizeEnd],
  );

  const getPositionStyle = () => {
    const baseStyle = {
      backgroundColor: '#0066ff',
      border: '1px solid #fff',
      borderRadius: '50%',
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      cursor: 'nwse-resize',
      height: 8,
      pointerEvents: 'auto' as const,
      position: 'absolute' as const,
      width: 8,
      zIndex: 9999,
    };

    switch (position) {
      case 'nw': {
        return { ...baseStyle, cursor: 'nw-resize', left: -4, top: -4 };
      }
      case 'ne': {
        return { ...baseStyle, cursor: 'ne-resize', right: -4, top: -4 };
      }
      case 'sw': {
        return { ...baseStyle, bottom: -4, cursor: 'sw-resize', left: -4 };
      }
      case 'se': {
        return { ...baseStyle, bottom: -4, cursor: 'se-resize', right: -4 };
      }
    }
  };

  return <div onMouseDown={handleMouseDown} style={getPositionStyle()} />;
});

ResizeHandle.displayName = 'ResizeHandle';

const Image = memo<{ className?: string; node: ImageNode }>(({ node, className }) => {
  const { styles, cx } = useStyles();
  const [isSelected, setSelected] = useLexicalNodeSelection(node.getKey());
  const [scale, setScale] = useState(1);
  const [size, setSize] = useState({ height: 0, width: 0 });
  const [newWidth, setNewWidth] = useState<number | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const originalSizeRef = useRef({ height: 0, width: 0 });
  const editorRef = useRef<any>(null);

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
    (deltaX: number, deltaY: number) => {
      if (!originalSizeRef.current.width || !originalSizeRef.current.height) return;

      // Calculate new width, considering both horizontal and vertical dragging
      const widthDelta = deltaX;
      const heightDelta = deltaY;

      // Convert height change to width change (based on original aspect ratio)
      const aspectRatio = originalSizeRef.current.width / originalSizeRef.current.height;
      const widthFromHeight = heightDelta * aspectRatio;

      // Use the larger change value as the final width adjustment
      const finalWidthDelta =
        Math.abs(widthDelta) > Math.abs(widthFromHeight) ? widthDelta : widthFromHeight;

      const newWidth = Math.max(50, size.width + finalWidthDelta);

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
    (deltaX: number, deltaY: number) => {
      if (!originalSizeRef.current.width || !originalSizeRef.current.height) return;

      const widthDelta = deltaX;
      const heightDelta = deltaY;
      const aspectRatio = originalSizeRef.current.width / originalSizeRef.current.height;
      const widthFromHeight = heightDelta * aspectRatio;
      const finalWidthDelta =
        Math.abs(widthDelta) > Math.abs(widthFromHeight) ? widthDelta : widthFromHeight;
      const finalWidth = Math.max(50, size.width + finalWidthDelta);

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

      {/* Resize handles */}
      {isSelected && (
        <>
          <ResizeHandle onResize={handleResize} onResizeEnd={handleResizeEnd} position="nw" />
          <ResizeHandle onResize={handleResize} onResizeEnd={handleResizeEnd} position="ne" />
          <ResizeHandle onResize={handleResize} onResizeEnd={handleResizeEnd} position="sw" />
          <ResizeHandle onResize={handleResize} onResizeEnd={handleResizeEnd} position="se" />
        </>
      )}
    </div>
  );
});

Image.displayName = 'Image';

export default Image;
