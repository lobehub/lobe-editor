import { cx } from 'antd-style';
import {
  type FC,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useCallback,
  useRef,
} from 'react';

import { styles } from './style';

export interface ResizeHandleProps {
  imageRef: RefObject<HTMLDivElement | null>;
  isBlock: boolean;
  onResize: (deltaX: number, deltaY: number, position: 'left' | 'right') => void;
  onResizeEnd?: (deltaX: number, deltaY: number) => void;
  onResizeStart: (initialWidth: number) => void;
  position: 'left' | 'right';
}

export const ResizeHandle: FC<ResizeHandleProps> = ({
  imageRef,
  isBlock,
  onResize,
  onResizeEnd,
  onResizeStart,
  position,
}) => {
  const startWidthRef = useRef<number>(0);

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Get the actual current width at mousedown time
      const initialWidth = imageRef.current?.offsetWidth || 0;
      startWidthRef.current = initialWidth;

      // Notify parent component of the initial width
      onResizeStart(initialWidth);

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
    [imageRef, isBlock, onResize, onResizeEnd, onResizeStart, position],
  );

  return (
    <div
      className={cx(
        styles.resizeHandle,
        position === 'left' ? styles.resizeHandleLeft : styles.resizeHandleRight,
      )}
      onMouseDown={handleMouseDown}
    />
  );
};

ResizeHandle.displayName = 'ResizeHandle';
