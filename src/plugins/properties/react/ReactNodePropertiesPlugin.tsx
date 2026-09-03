'use client';

import {
  $getNearestNodeFromDOMNode,
  $getSelection,
  type BaseSelection,
  COMMAND_PRIORITY_LOW,
  getDOMSelection,
} from 'lexical';
import type { CSSProperties, FC } from 'react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLexicalComposerContext, useLexicalEditor } from '@/editor-kernel/react';
import { getDOMRangeRect } from '@/plugins/toolbar/utils/getDOMRangeRect';

import { CREATE_ANNOTATION_COMMAND, OPEN_ANNOTATION_COMPOSER_COMMAND } from '../command';
import { PropertiesPlugin } from '../plugin';
import { type AnnotationService, IAnnotationService } from '../service/annotation';
import type { AnnotationRecord } from '../types';
import { getAnnotationIdsFromDOM } from '../utils-dom';
import type { ReactNodePropertiesPluginProps } from './type';

const ReactNodePropertiesPlugin: FC<ReactNodePropertiesPluginProps> = ({
  activeAnnotationIds,
  annotationStorageMode,
  children,
  composerContainer,
  onAnnotationClick,
  onComposerChange,
  readOnly,
  renderAnnotationBubble,
  renderComposer,
  storageMode,
}) => {
  const [editor] = useLexicalComposerContext();
  const propsRef = useRef({
    composerContainer,
    onAnnotationClick,
    onComposerChange,
    readOnly,
    renderAnnotationBubble,
    renderComposer,
  });
  const [bubble, setBubble] = useState<{
    nodeKey: string | null;
    records: AnnotationRecord[];
    rect: DOMRect;
  } | null>(null);
  const [composerVisible, setComposerVisible] = useState(false);
  const [composerRect, setComposerRect] = useState<DOMRect | null>(null);
  const composerSelectionRef = useRef<BaseSelection | null>(null);
  const composerNodeKeysRef = useRef<string[] | undefined>(undefined);
  const composerAnchorNodeKeysRef = useRef<string[] | undefined>(undefined);
  const composerRectIsExplicitRef = useRef(false);
  const composerQuotedTextRef = useRef('');

  propsRef.current = {
    composerContainer,
    onAnnotationClick,
    onComposerChange,
    readOnly,
    renderAnnotationBubble,
    renderComposer,
  };

  useLayoutEffect(() => {
    editor.registerPlugin(PropertiesPlugin, {
      annotationStorageMode,
      readOnly,
      storageMode,
    });
    if (annotationStorageMode || storageMode) {
      editor
        .requireService(IAnnotationService)
        ?.setStorageMode(annotationStorageMode ?? storageMode!);
    }
  }, [annotationStorageMode, editor, readOnly, storageMode]);

  useLexicalEditor(
    (lexicalEditor) =>
      lexicalEditor.registerCommand(
        OPEN_ANNOTATION_COMPOSER_COMMAND,
        (payload) => {
          if (propsRef.current.readOnly || !lexicalEditor.isEditable()) return true;
          if (propsRef.current.renderComposer || propsRef.current.onComposerChange) {
            lexicalEditor.getEditorState().read(() => {
              const selection = $getSelection();
              composerSelectionRef.current = selection?.clone() ?? null;
              composerNodeKeysRef.current = payload.nodeKeys;
              composerAnchorNodeKeysRef.current =
                payload.nodeKeys && payload.nodeKeys.length > 0
                  ? [...payload.nodeKeys]
                  : getSelectionNodeKeys(selection);
              composerQuotedTextRef.current =
                payload.quotedText ?? selection?.getTextContent() ?? '';
            });
            const hasExplicitTarget = Boolean(payload.nodeKeys && payload.nodeKeys.length > 0);
            composerRectIsExplicitRef.current = Boolean(payload.rect) || hasExplicitTarget;
            setComposerRect(
              payload.rect ??
                (hasExplicitTarget ? null : getCurrentSelectionRect(lexicalEditor)) ??
                getNodeKeysRect(lexicalEditor, composerAnchorNodeKeysRef.current),
            );
            setComposerVisible(true);
          } else {
            lexicalEditor.dispatchCommand(CREATE_ANNOTATION_COMMAND, {
              kind: payload.kind,
              payload: payload.payload ?? null,
            });
          }
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor],
  );

  useLayoutEffect(
    () => () => {
      // Do not let a host retain a selection snapshot after this editor unmounts.
      propsRef.current.onComposerChange?.(null);
    },
    [],
  );

  useLexicalEditor(
    (lexicalEditor) => {
      let currentRoot = lexicalEditor.getRootElement();
      const sync = () => {
        currentRoot = currentRoot ?? lexicalEditor.getRootElement();
        syncActiveAnnotationState(currentRoot, activeAnnotationIds);
      };

      sync();
      const observer = typeof MutationObserver !== 'undefined' ? new MutationObserver(sync) : null;
      const observeRoot = (root: HTMLElement | null) => {
        observer?.disconnect();
        if (!root) return;
        observer?.observe(root, {
          attributeFilter: ['data-annotation-ids'],
          attributes: true,
          childList: true,
          subtree: true,
        });
      };
      const unregisterUpdate = lexicalEditor.registerUpdateListener(sync);
      const unregisterRoot = lexicalEditor.registerRootListener((root, previousRoot) => {
        if (previousRoot) syncActiveAnnotationState(previousRoot, []);
        currentRoot = root;
        observeRoot(root);
        sync();
      });

      return () => {
        observer?.disconnect();
        unregisterUpdate();
        unregisterRoot();
        // Remove state owned by this plugin from this editor only. In
        // particular, never query document-wide nodes during cleanup.
        syncActiveAnnotationState(currentRoot, []);
      };
    },
    [activeAnnotationIds, editor],
  );

  useLayoutEffect(() => {
    if (!composerVisible) return;
    const lexicalEditor = editor.getLexicalEditor();
    if (!lexicalEditor) return;

    const updatePosition = () => {
      const nextRect = composerRectIsExplicitRef.current
        ? getNodeKeysRect(lexicalEditor, composerAnchorNodeKeysRef.current)
        : (getCurrentSelectionRect(lexicalEditor) ??
          getNodeKeysRect(lexicalEditor, composerAnchorNodeKeysRef.current));
      if (nextRect) setComposerRect(nextRect);
    };
    const options = { capture: true, passive: true } as const;
    window.addEventListener('scroll', updatePosition, options);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, options);

    return () => {
      window.removeEventListener('scroll', updatePosition, options);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, options);
    };
  }, [composerVisible, editor]);

  useLexicalEditor(
    (lexicalEditor) => {
      const root = lexicalEditor.getRootElement();
      if (!root) return;

      const onClick = (event: MouseEvent) => {
        const target = event.target instanceof Element ? event.target : null;
        const annotationElement = target?.closest('[data-annotation-ids]');
        if (!annotationElement || !root.contains(annotationElement)) return;
        const ids = getAnnotationIdsFromDOM(annotationElement);
        const groupIds = getAnnotationGroupIds(annotationElement, root, ids);
        const service = editor.requireService(IAnnotationService) as AnnotationService | null;
        const records = ids
          .map((id) => service?.get(id))
          .filter((record): record is AnnotationRecord => Boolean(record));
        records.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
        if (ids.length === 0) return;
        const logicalBlockKey = annotationElement.getAttribute('data-block-id');
        let nodeKey: string | null =
          logicalBlockKey ?? annotationElement.getAttribute('data-lexical-node-key');
        lexicalEditor.read(() => {
          nodeKey =
            logicalBlockKey ?? $getNearestNodeFromDOMNode(annotationElement)?.getKey() ?? nodeKey;
        });

        const rect = annotationElement.getBoundingClientRect();
        if (propsRef.current.onAnnotationClick) {
          propsRef.current.onAnnotationClick({ groupIds, ids, nodeKey, records, rect });
          return;
        }

        if (records.length === 0) return;
        setBubble({
          nodeKey,
          records,
          rect,
        });
      };

      root.addEventListener('click', onClick);
      return () => root.removeEventListener('click', onClick);
    },
    [editor],
  );

  const selectedText = (() => {
    const lexicalEditor = editor.getLexicalEditor();
    if (!lexicalEditor) return '';
    return lexicalEditor.getEditorState().read(() => $getSelection()?.getTextContent() ?? '');
  })();
  const closeComposer = useCallback(() => {
    setComposerVisible(false);
    setComposerRect(null);
    composerSelectionRef.current = null;
    composerNodeKeysRef.current = undefined;
    composerAnchorNodeKeysRef.current = undefined;
    composerRectIsExplicitRef.current = false;
    composerQuotedTextRef.current = '';
  }, []);
  const submitComposer = useCallback(
    (payload: { kind?: string; payload: any }) => {
      editor.dispatchCommand(CREATE_ANNOTATION_COMMAND, {
        ...payload,
        nodeKeys: composerNodeKeysRef.current,
        quotedText: composerQuotedTextRef.current || selectedText,
        selection: composerSelectionRef.current,
      });
      closeComposer();
    },
    [closeComposer, editor, selectedText],
  );
  const composerContext = useMemo(() => {
    const anchorNodeKeys = composerVisible ? composerAnchorNodeKeysRef.current : undefined;
    const nodeKeys = composerVisible ? composerNodeKeysRef.current : undefined;
    return {
      close: closeComposer,
      anchorNodeKeys: anchorNodeKeys ? [...anchorNodeKeys] : undefined,
      nodeKeys: nodeKeys ? [...nodeKeys] : undefined,
      quotedText: composerQuotedTextRef.current || selectedText,
      rect: composerRect,
      records: [],
      submit: submitComposer,
    };
  }, [closeComposer, composerRect, composerVisible, selectedText, submitComposer]);
  const composerContextRef = useRef(composerContext);
  composerContextRef.current = composerContext;

  useLayoutEffect(() => {
    if (!onComposerChange) return;
    onComposerChange(composerVisible ? composerContextRef.current : null);
  }, [composerVisible, composerRect, onComposerChange]);

  const bubbleNode =
    bubble &&
    (propsRef.current.renderAnnotationBubble ? (
      propsRef.current.renderAnnotationBubble({
        close: () => setBubble(null),
        nodeKey: bubble.nodeKey,
        records: bubble.records,
      })
    ) : (
      <div
        style={{
          background: 'var(--lobe-color-bg-container, white)',
          border: '1px solid var(--lobe-color-border, #ddd)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgb(0 0 0 / 16%)',
          maxWidth: 320,
          padding: 12,
          position: 'fixed',
          zIndex: 1000,
        }}
      >
        {bubble.records.map((record) => (
          <div key={record.id} data-annotation-record={record.id}>
            <strong>{record.kind}</strong>
            <div>{renderJSON(record.payload)}</div>
          </div>
        ))}
        <button type="button" onClick={() => setBubble(null)}>
          Close
        </button>
      </div>
    ));

  const positionedBubble =
    bubble && bubbleNode
      ? createPortal(
          <div
            style={{
              left: Math.max(8, bubble.rect.left),
              position: 'fixed',
              top: bubble.rect.bottom + 8,
              zIndex: 1000,
            }}
          >
            {bubbleNode}
          </div>,
          document.body,
        )
      : null;

  const composerNode =
    composerVisible &&
    propsRef.current.renderComposer &&
    !propsRef.current.onComposerChange &&
    typeof document !== 'undefined'
      ? createPortal(
          <div
            data-annotation-composer="true"
            style={propsRef.current.composerContainer ? undefined : getComposerStyle(composerRect)}
          >
            {propsRef.current.renderComposer(composerContext)}
          </div>,
          propsRef.current.composerContainer ?? document.body,
        )
      : null;

  return (
    <>
      <style>{`
        [data-annotation="true"] {
          cursor: pointer;
        }
        [data-annotation-scope="range"] {
          text-decoration-line: underline;
          text-decoration-style: dotted;
          text-decoration-thickness: 1.5px;
          text-decoration-color: var(--lobe-color-primary, #1677ff);
          text-underline-offset: 3px;
        }
        [data-annotation-scope="range"][data-annotation-active="true"] {
          background-color: var(--lobe-color-primary-bg, var(--ant-color-primary-bg, rgb(22 119 255 / 12%)));
          text-decoration-color: var(--lobe-color-primary-hover, var(--ant-color-primary-hover, var(--lobe-color-primary, #1677ff)));
          text-decoration-thickness: 3px;
        }
        @supports (background-color: color-mix(in srgb, red 10%, transparent)) {
          [data-annotation-scope="range"][data-annotation-active="true"] {
            background-color: color-mix(in srgb, var(--lobe-color-primary, #1677ff) 14%, transparent);
          }
        }
        [data-annotation-scope="block"] {
          border-radius: 4px;
          outline: 2px solid var(--lobe-color-primary, #1677ff);
          outline-offset: 2px;
        }
        [data-annotation-scope="block"][data-annotation-active="true"] {
          outline: 3px solid var(--lobe-color-primary-hover, var(--ant-color-primary-hover, var(--lobe-color-primary, #1677ff)));
          box-shadow: 0 0 0 4px var(--lobe-color-primary-bg, var(--ant-color-primary-bg, rgb(22 119 255 / 14%)));
        }
        @supports (box-shadow: 0 0 0 2px color-mix(in srgb, red 10%, transparent)) {
          [data-annotation-scope="block"][data-annotation-active="true"] {
            box-shadow: 0 0 0 4px color-mix(in srgb, var(--lobe-color-primary, #1677ff) 16%, transparent);
          }
        }
      `}</style>
      {!readOnly && children}
      {positionedBubble}
      {composerNode}
    </>
  );
};

ReactNodePropertiesPlugin.displayName = 'ReactNodePropertiesPlugin';

function renderJSON(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default ReactNodePropertiesPlugin;

/**
 * Apply active state only inside one Lexical editor root. The selector also
 * includes previously-active elements so a selection change removes stale
 * attributes even when an annotation id has just been removed from a node.
 */
function syncActiveAnnotationState(
  root: HTMLElement | null,
  activeAnnotationIds: readonly string[] | undefined,
): void {
  if (!root) return;

  const activeIds = new Set(
    (activeAnnotationIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    ),
  );
  const elements = new Set<HTMLElement>();
  if (root.matches('[data-annotation-ids], [data-annotation-active="true"]')) {
    elements.add(root);
  }
  root
    .querySelectorAll<HTMLElement>('[data-annotation-ids], [data-annotation-active="true"]')
    .forEach((element) => elements.add(element));

  for (const element of elements) {
    const isActive = getAnnotationIdsFromDOM(element).some((id) => activeIds.has(id));
    if (isActive) element.dataset.annotationActive = 'true';
    else delete element.dataset.annotationActive;
  }
}

/**
 * Return all annotation ids in the semantic block containing a clicked
 * annotation. Range annotations may be split into several DOM nodes, and a
 * group is defined by the same block boundary used by rail measurement.
 */
function getAnnotationGroupIds(
  annotationElement: Element,
  root: HTMLElement,
  clickedIds: readonly string[],
): string[] {
  const group = annotationElement.closest('[data-block-id]');
  if (!group || !root.contains(group)) return [...clickedIds];

  const ids = new Set(clickedIds);
  if (group.hasAttribute('data-annotation-ids')) {
    for (const id of getAnnotationIdsFromDOM(group)) ids.add(id);
  }
  group.querySelectorAll<HTMLElement>('[data-annotation-ids]').forEach((element) => {
    for (const id of getAnnotationIdsFromDOM(element)) ids.add(id);
  });
  return [...ids];
}

function getCurrentSelectionRect(lexicalEditor: import('lexical').LexicalEditor): DOMRect | null {
  const rootElement = lexicalEditor.getRootElement();
  if (!rootElement) return null;

  const nativeSelection = getDOMSelection(lexicalEditor._window);
  if (
    !nativeSelection ||
    nativeSelection.rangeCount === 0 ||
    nativeSelection.isCollapsed ||
    !rootElement.contains(nativeSelection.anchorNode)
  ) {
    return null;
  }

  try {
    return getDOMRangeRect(nativeSelection, rootElement);
  } catch {
    return null;
  }
}

/**
 * Resolve a stable visual anchor from the nodes in the saved Lexical selection.
 *
 * Toolbar and composer clicks can clear the native DOM selection. The Lexical
 * selection snapshot still points at the original text nodes, so their DOM
 * rectangles provide a useful fallback while keeping the selection itself out
 * of the annotation target payload.
 */
function getNodeKeysRect(
  lexicalEditor: import('lexical').LexicalEditor,
  nodeKeys?: ReadonlyArray<string>,
): DOMRect | null {
  const rootElement = lexicalEditor.getRootElement();
  if (!rootElement || !nodeKeys || nodeKeys.length === 0) return null;

  const elements = nodeKeys
    .map((nodeKey) => lexicalEditor.getElementByKey(nodeKey))
    .filter((element): element is HTMLElement => {
      return element instanceof HTMLElement && rootElement.contains(element);
    });
  if (elements.length === 0) return null;

  const rects = elements.flatMap((element) => {
    const clientRects = Array.from(element.getClientRects());
    return clientRects.length > 0 ? clientRects : [element.getBoundingClientRect()];
  });
  if (rects.length === 0) return null;

  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
}

function getSelectionNodeKeys(selection: BaseSelection | null): string[] | undefined {
  if (!selection) return undefined;

  const keys = new Set<string>();
  try {
    for (const node of selection.getNodes()) keys.add(node.getKey());
  } catch {
    // A selection clone may be read outside the editor state transaction. The
    // range endpoints below still provide a stable DOM lookup in that case.
  }

  const range = selection as BaseSelection & {
    anchor?: { key?: string };
    focus?: { key?: string };
  };
  if (range.anchor?.key) keys.add(range.anchor.key);
  if (range.focus?.key) keys.add(range.focus.key);

  return keys.size > 0 ? [...keys] : undefined;
}

function getComposerStyle(rect: DOMRect | null): CSSProperties {
  const viewportWidth = typeof window === 'undefined' ? 360 : window.innerWidth || 360;
  const viewportHeight = typeof window === 'undefined' ? 240 : window.innerHeight || 240;
  const preferredLeft = rect?.left ?? 8;
  const belowTop = (rect?.bottom ?? 0) + 8;
  const preferredTop = belowTop + 8 <= viewportHeight ? belowTop : (rect?.top ?? 8) - 8;
  const left = Math.min(Math.max(8, preferredLeft), Math.max(8, viewportWidth - 360));
  const top = Math.min(Math.max(8, preferredTop), Math.max(8, viewportHeight - 16));

  return {
    left,
    maxHeight: 'calc(100vh - 16px)',
    maxWidth: 'calc(100vw - 16px)',
    overflow: 'auto',
    position: 'fixed',
    top,
    zIndex: 1001,
  };
}
