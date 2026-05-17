'use client';

import { Icon } from '@lobehub/ui';
import { cx } from 'antd-style';
import { GripVerticalIcon } from 'lucide-react';
import {
  type CSSProperties,
  type FC,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { ILocaleKeys } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { BlockPlugin, type BlockPluginOptions } from '../plugin';
import { BlockMenuService, type IBlockMenuRenderContext, IBlockMenuService } from '../service';
import { HOVER_HIDE_DELAY } from './core/constants';
import {
  type HoveredBlockState,
  type RuntimeContextRef,
  createRuntimeContext,
} from './core/runtime-context';
import { type BlockDragTarget } from './core/types';
import { startBlockDragSession } from './drag/drag-session';
import { styles } from './style';

export interface ReactBlockPluginProps extends Omit<BlockPluginOptions, 'className'> {
  className?: string;
  locale?: Partial<Record<keyof ILocaleKeys, string>>;
  onDragTargetChange?: (target: BlockDragTarget | null) => void;
  onDragTargetResolve?: (target: BlockDragTarget | null) => void;
  onHoverBlockChange?: (context: IBlockMenuRenderContext | null) => void;
  rootClassName?: string;
}

const logger = createDebugLogger('plugin', 'block-react');

const ReactBlockPlugin: FC<ReactBlockPluginProps> = (props) => {
  const [editor] = useLexicalComposerContext();
  const {
    rootClassName,
    className,
    attributeName,
    locale,
    onHoverBlockChange,
    onDragTargetChange,
    onDragTargetResolve,
  } = props;
  const mergedRootClassName = cx(styles.root, rootClassName?.trim() || className?.trim());
  const menuRef = useRef<HTMLDivElement>(null);
  const operationMenuRef = useRef<HTMLDivElement>(null);
  const [hoveredBlock, setHoveredBlock] = useState<HoveredBlockState>(null);
  const contextRef = useRef<RuntimeContextRef>(createRuntimeContext());
  const [menuVersion, setMenuVersion] = useState(0);
  const [menuPosition, setMenuPosition] = useState<CSSProperties>({});
  const [operationMenuOpen, setOperationMenuOpen] = useState(false);
  const [operationMenuWidth, setOperationMenuWidth] = useState(120);
  const [operationMenuContext, setOperationMenuContext] = useState<IBlockMenuRenderContext | null>(
    null,
  );
  const [dragIndicator, setDragIndicator] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const [blockMenuService, setBlockMenuService] = useState<BlockMenuService | null>(null);

  useLayoutEffect(() => {
    if (locale) {
      editor.registerLocale(locale);
    }

    editor.registerPlugin(BlockPlugin, {
      attributeName,
      className: mergedRootClassName,
    });
  }, [attributeName, editor, locale, mergedRootClassName]);

  useLexicalEditor(() => {
    const service = editor.requireService(IBlockMenuService) as BlockMenuService | null;
    if (!service) {
      logger.warn('BlockMenuService not found');
      return;
    }

    setBlockMenuService(service);

    return () => {
      setBlockMenuService((current) => (current === service ? null : current));
    };
  }, []);

  useEffect(() => {
    contextRef.current.hoveredBlock = hoveredBlock;
  }, [hoveredBlock]);

  useEffect(() => {
    if (!blockMenuService) return;

    return blockMenuService.subscribe(() => {
      setMenuVersion((v) => v + 1);
    });
  }, [blockMenuService]);

  useEffect(() => {
    return () => {
      contextRef.current.dragCleanup?.();
      contextRef.current.dragCleanup = null;
    };
  }, []);

  useEffect(() => {
    const getHoveredBlock = (target: EventTarget | null) => {
      const root = editor.getRootElement();

      if (!root || !(target instanceof Node)) {
        return null;
      }

      const targetElement = target instanceof Element ? target : target.parentElement;
      if (!targetElement) {
        return null;
      }

      if (menuRef.current?.contains(targetElement)) {
        return contextRef.current.hoveredBlock;
      }

      if (operationMenuRef.current?.contains(targetElement)) {
        return contextRef.current.hoveredBlock;
      }

      const blockElement = targetElement.closest('[data-block-id]');

      if (!(blockElement instanceof HTMLElement) || !root.contains(blockElement)) {
        return null;
      }

      const blockId = blockElement.dataset.blockId;
      if (!blockId) {
        return null;
      }

      return { blockElement, blockId };
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (contextRef.current.draggingSource) {
        return;
      }

      const next = getHoveredBlock(event.target);

      if (next) {
        if (contextRef.current.hideTimer !== null) {
          window.clearTimeout(contextRef.current.hideTimer);
          contextRef.current.hideTimer = null;
        }

        setHoveredBlock((current) => {
          if (!current) return next;
          if (next.blockId === current.blockId && next.blockElement === current.blockElement) {
            return current;
          }
          return next;
        });

        return;
      }

      if (contextRef.current.hideTimer !== null) {
        return;
      }

      contextRef.current.hideTimer = window.setTimeout(() => {
        contextRef.current.hideTimer = null;
        setHoveredBlock((current) => (current ? null : current));
      }, HOVER_HIDE_DELAY);
    };

    document.addEventListener('mousemove', handleMouseMove, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);

      if (contextRef.current.hideTimer !== null) {
        window.clearTimeout(contextRef.current.hideTimer);
        contextRef.current.hideTimer = null;
      }
    };
  }, [editor]);

  useEffect(() => {
    if (!hoveredBlock) {
      if (operationMenuOpen) {
        return;
      }

      setMenuPosition({});
      return;
    }

    const updateMenuPosition = () => {
      const rect = hoveredBlock.blockElement.getBoundingClientRect();
      const menuWidth = menuRef.current?.offsetWidth || 24;
      const gap = 8;

      setMenuPosition({
        left: Math.max(gap, rect.left - menuWidth - gap),
        top: rect.top,
      });
    };

    updateMenuPosition();

    window.addEventListener('resize', updateMenuPosition);
    document.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      document.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [hoveredBlock]);

  const menuContext = useMemo<IBlockMenuRenderContext | null>(() => {
    if (!hoveredBlock) return null;

    return {
      blockElement: hoveredBlock.blockElement,
      blockId: hoveredBlock.blockId,
      editor,
    };
  }, [editor, hoveredBlock]);

  const operationMenus = useMemo(() => {
    if (!operationMenuContext || !blockMenuService) return [];

    return blockMenuService.getMenus(operationMenuContext);
  }, [blockMenuService, operationMenuContext, menuVersion]);

  useEffect(() => {
    onHoverBlockChange?.(menuContext);
  }, [menuContext, onHoverBlockChange]);

  useEffect(() => {
    if (!operationMenuOpen || !menuContext || !contextRef.current.operationMenuAnchorBlockId) {
      return;
    }

    if (contextRef.current.operationMenuAnchorBlockId !== menuContext.blockId) {
      setOperationMenuOpen(false);
      setOperationMenuContext(null);
    }
  }, [menuContext, operationMenuOpen]);

  useEffect(() => {
    if (!operationMenuOpen) {
      contextRef.current.operationMenuAnchorBlockId = null;
      setOperationMenuContext(null);
    }
  }, [operationMenuOpen]);

  useLayoutEffect(() => {
    if (!operationMenuOpen || !operationMenuRef.current) return;

    const width = operationMenuRef.current.offsetWidth;
    if (width > 0 && width !== operationMenuWidth) {
      setOperationMenuWidth(width);
    }
  }, [operationMenuContext, operationMenuOpen, operationMenuWidth, operationMenus.length]);

  useEffect(() => {
    onDragTargetChange?.(contextRef.current.dragTarget);
  }, [dragIndicator, onDragTargetChange]);

  const preventEditorSelectionLost = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const dragHandle = target?.closest('[data-block-drag-handle="true"]');

    if (dragHandle) {
      return;
    }

    event.preventDefault();
  };

  const clearDragPreview = () => {
    contextRef.current.dragTarget = null;
    setDragIndicator(null);
  };

  const toggleOperationMenu = (context: IBlockMenuRenderContext | null) => {
    if (!context) {
      setOperationMenuOpen(false);
      setOperationMenuContext(null);
      return;
    }

    setOperationMenuOpen((open) => {
      const shouldOpen = !(
        open && contextRef.current.operationMenuAnchorBlockId === context.blockId
      );
      contextRef.current.operationMenuAnchorBlockId = shouldOpen ? context.blockId : null;
      setOperationMenuContext(shouldOpen ? context : null);
      return shouldOpen;
    });
  };

  const handleDragHandlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!menuContext) return;

    event.stopPropagation();

    startBlockDragSession({
      clearDragPreview,
      clientX: event.clientX,
      clientY: event.clientY,
      contextRef,
      editor,
      menuContext,
      onDragTargetResolve,
      setDragIndicator,
      setOperationMenuContext,
      setOperationMenuOpen,
      toggleOperationMenu,
    });
  };

  const handleDragHandleClick = () => {
    if (contextRef.current.ignoreNextHandleClick) {
      contextRef.current.ignoreNextHandleClick = false;
      return;
    }

    toggleOperationMenu(menuContext);
  };

  if (!menuContext && !dragIndicator && !(operationMenuOpen && operationMenuContext)) return null;

  const menuNode = menuContext ? (
    <div
      className={styles.menu}
      onMouseDown={preventEditorSelectionLost}
      ref={menuRef}
      style={menuPosition}
    >
      <div className={styles.menuInner}>
        <div
          aria-label={'Block actions and drag'}
          className={styles.dragHandle}
          data-block-drag-handle={'true'}
          draggable={false}
          onClick={handleDragHandleClick}
          onPointerDown={handleDragHandlePointerDown}
          role={'button'}
          tabIndex={-1}
          title={'Block actions and drag'}
        >
          <Icon icon={GripVerticalIcon} size={14} />
        </div>
      </div>
    </div>
  ) : null;

  const operationMenuNode = operationMenuContext &&
    operationMenuOpen &&
    operationMenus.length > 0 && (
      <div
        className={styles.operationMenu}
        onMouseDown={(event) => event.preventDefault()}
        ref={operationMenuRef}
        style={{
          left: Math.max(8, Number(menuPosition.left || 0) - operationMenuWidth - 4),
          top: Number(menuPosition.top || 0),
        }}
      >
        {operationMenus.map((item) => (
          <button
            className={styles.operationMenuItem}
            key={item.key}
            onClick={() => {
              item.onClick(operationMenuContext);
              setOperationMenuOpen(false);
              setOperationMenuContext(null);
            }}
            type={'button'}
          >
            {typeof item.label === 'function' ? item.label(operationMenuContext) : item.label}
          </button>
        ))}
      </div>
    );

  return createPortal(
    <>
      {menuNode}
      {operationMenuNode}
      {dragIndicator && (
        <div
          className={styles.dragIndicator}
          style={{
            left: dragIndicator.left,
            top: dragIndicator.top,
            width: dragIndicator.width,
          }}
        />
      )}
    </>,
    document.body,
  );
};

ReactBlockPlugin.displayName = 'ReactBlockPlugin';

export default ReactBlockPlugin;
