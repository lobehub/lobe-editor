'use client';

import { Segmented } from 'antd';
import { cx } from 'antd-style';
import { debounce } from 'es-toolkit/compat';
import type { LexicalEditor } from 'lexical';
import { $getNodeByKey, COMMAND_PRIORITY_HIGH } from 'lexical';
import { CodeXml, Columns2, Eye } from 'lucide-react';
import type { ChangeEvent, CSSProperties, FC, MouseEvent, PointerEvent } from 'react';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import type { ICodeMirrorInstance } from '@/codemirror';
import { loadCodeMirror, lobeTheme } from '@/codemirror';
import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';
import { BLOCK_MENU_ANCHOR_ATTRIBUTE } from '@/plugins/block/react/core/types';
import { ENTER_HOLE_CONTENT_COMMAND } from '@/plugins/common/command';
import { $getNodeId } from '@/plugins/properties/utils';

import { SELECT_AFTER_ARTIFACT_COMMAND, SELECT_BEFORE_ARTIFACT_COMMAND } from '../command';
import { $isArtifactNode, type ArtifactNode } from '../node/ArtifactNode';
import ArtifactPreview from './ArtifactPreview';
import { $getArtifactSelectionState, useArtifactSelectionState } from './selection';
import { artifactStyles } from './style';
import type { ArtifactLabels } from './type';

interface ArtifactViewProps {
  allowScripts: boolean;
  className?: string;
  editor: LexicalEditor;
  labels?: ArtifactLabels;
  node: ArtifactNode;
  previewHeight: number;
}

export type ArtifactViewMode = 'split' | 'code-only' | 'preview-only';

const ARTIFACT_VIEW_MODE_STORAGE_PREFIX = 'lobe-artifact-view-mode:';

const readStoredArtifactViewMode = (storageKey: string): ArtifactViewMode | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const value = window.localStorage.getItem(storageKey);
    if (value === 'preview') return 'preview-only';
    return value === 'code-only' || value === 'preview-only' || value === 'split'
      ? value
      : undefined;
  } catch {
    return undefined;
  }
};

const getArtifactStorageKey = (editor: LexicalEditor, node: ArtifactNode): string => {
  let identity = node.getKey();
  try {
    editor.getEditorState().read(() => {
      const currentNode = $getNodeByKey(node.getKey());
      identity = currentNode ? $getNodeId(currentNode) || identity : identity;
    });
  } catch {
    // Runtime node keys still provide a session-local fallback when NodeState
    // is unavailable during an early decorator render.
  }
  return `${ARTIFACT_VIEW_MODE_STORAGE_PREFIX}${identity}`;
};

const persistArtifactViewMode = (storageKey: string, mode: ArtifactViewMode): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, mode);
  } catch {
    // Storage can be unavailable in private/embedded contexts; the in-memory
    // state remains usable for the current mounted Artifact.
  }
};

const ArtifactView: FC<ArtifactViewProps> = ({
  allowScripts,
  className,
  editor,
  labels,
  node,
  previewHeight,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const instanceRef = useRef<ICodeMirrorInstance | null>(null);
  const [editable, setEditable] = useState(editor.isEditable());
  const [html, dispatchHtml] = useReducer((_state: string, value: string) => value, node.getHtml());
  const [title, dispatchTitle] = useReducer(
    (_state: string, value: string) => value,
    node.getTitle(),
  );
  const [codeMirrorLoadFailed, dispatchCodeMirrorLoadFailed] = useReducer(
    (_current: boolean, next: boolean) => next,
    false,
  );
  const nodeKeyRef = useRef(node.getKey());
  const htmlRef = useRef(html);
  const nodeHtmlRef = useRef(node.getHtml());
  const [, setSelected, clearSelection] = useLexicalNodeSelection(node.getKey());
  const selectionState = useArtifactSelectionState(editor, node.getKey());
  const [blockSelectionSuppressed, setBlockSelectionSuppressed] = useReducer(
    (_current: boolean, next: boolean) => next,
    false,
  );
  const [viewMode, setViewMode] = useState<ArtifactViewMode>(
    () => readStoredArtifactViewMode(getArtifactStorageKey(editor, node)) ?? 'split',
  );
  const codePaneVisible = editable && viewMode !== 'preview-only';
  const storageKeyRef = useRef(getArtifactStorageKey(editor, node));
  nodeKeyRef.current = node.getKey();
  htmlRef.current = html;
  const persistHtmlRef = useRef(
    debounce((value: string) => {
      editor.update(() => {
        const currentNode = $getNodeByKey(nodeKeyRef.current);
        if ($isArtifactNode(currentNode)) {
          currentNode.setHtml(value);
        }
      });
    }, 200),
  );

  useEffect(() => editor.registerEditableListener(setEditable), [editor]);

  useEffect(() => {
    const storageKey = getArtifactStorageKey(editor, node);
    storageKeyRef.current = storageKey;
    const stored = readStoredArtifactViewMode(storageKey);
    if (stored) setViewMode(stored);
  }, [editor, node]);

  useEffect(() => {
    persistArtifactViewMode(storageKeyRef.current, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!selectionState.covered) setBlockSelectionSuppressed(false);
  }, [selectionState.covered]);

  useEffect(() => {
    const nextHtml = node.getHtml();
    const nextTitle = node.getTitle();
    const htmlChangedInEditor = nextHtml !== nodeHtmlRef.current;
    nodeHtmlRef.current = nextHtml;
    dispatchTitle(nextTitle);
    if (htmlChangedInEditor) {
      dispatchHtml(nextHtml);
      if (instanceRef.current && instanceRef.current.getValue() !== nextHtml) {
        instanceRef.current.setValue(nextHtml);
      }
      persistHtmlRef.current.cancel();
    }
  }, [node]);

  useEffect(
    () =>
      editor.registerCommand(
        ENTER_HOLE_CONTENT_COMMAND,
        ({ edge, key }) => {
          if (!editable || key !== nodeKeyRef.current) return false;

          try {
            const instance = instanceRef.current;
            if (instance) {
              instance.focus();
              if (edge === 'start') instance.setSelectionToStart();
              else instance.setSelectionToEnd();
              return true;
            }

            const textarea = textareaRef.current;
            if (!codeMirrorLoadFailed || !textarea) return false;

            textarea.focus();
            const offset = edge === 'start' ? 0 : textarea.value.length;
            textarea.setSelectionRange(offset, offset);
            return true;
          } catch {
            return false;
          }
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [codeMirrorLoadFailed, editable, editor],
  );

  useEffect(() => {
    dispatchCodeMirrorLoadFailed(false);
    if (!codePaneVisible || !textareaRef.current) {
      instanceRef.current?.destroy();
      instanceRef.current = null;
      return;
    }

    let disposed = false;
    const textarea = textareaRef.current;
    void loadCodeMirror()
      .then((CodeMirror) => {
        if (disposed || instanceRef.current) return;
        let instance: ICodeMirrorInstance | null = null;
        try {
          instance = CodeMirror.fromTextArea(textarea, {
            indentWithTabs: false,
            lineNumbers: true,
            lineWrapping: true,
            mode: 'html',
            tabSize: 2,
            theme: 'default',
            value: htmlRef.current,
          });
          instance.view.dispatch({
            effects: instance.optionHelper.theme.reconfigure(
              instance.view.constructor.theme(lobeTheme, { dark: false }),
            ),
          });
          instance.on('change', () => {
            const value = instance!.getValue();
            dispatchHtml(value);
            persistHtmlRef.current(value);
          });
          instance.on('keydown', (_, event: KeyboardEvent) => {
            event.stopPropagation();
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              instance!.blur();
              editor.dispatchCommand(SELECT_AFTER_ARTIFACT_COMMAND, { key: nodeKeyRef.current });
            }
          });
          instance.on('leftOut', () => {
            instance!.blur();
            editor.dispatchCommand(SELECT_BEFORE_ARTIFACT_COMMAND, { key: nodeKeyRef.current });
          });
          instance.on('rightOut', () => {
            instance!.blur();
            editor.dispatchCommand(SELECT_AFTER_ARTIFACT_COMMAND, { key: nodeKeyRef.current });
          });
          if (disposed) {
            instance.destroy();
            return;
          }
          instanceRef.current = instance;
        } catch {
          instance?.destroy();
          if (!disposed) dispatchCodeMirrorLoadFailed(true);
        }
      })
      .catch(() => {
        if (!disposed) dispatchCodeMirrorLoadFailed(true);
      });

    return () => {
      disposed = true;
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [codePaneVisible, editor]);

  useEffect(
    () => () => {
      persistHtmlRef.current.cancel();
    },
    [],
  );

  const handleTitleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      dispatchTitle(value);
      editor.update(() => {
        const currentNode = $getNodeByKey(nodeKeyRef.current);
        if ($isArtifactNode(currentNode)) {
          currentNode.setTitle(value);
        }
      });
    },
    [editor],
  );

  const handleTextareaChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    dispatchHtml(value);
    persistHtmlRef.current(value);
  }, []);

  const handleMouseDown = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      if (!editable) return;
      setBlockSelectionSuppressed(false);
      if (!event.shiftKey) clearSelection();
      setSelected(true);
    },
    [clearSelection, editable, setSelected],
  );

  const handleCodeMouseDown = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      if (!editable) return;

      setBlockSelectionSuppressed(true);
      const directNodeSelection = editor
        .getEditorState()
        .read(() => $getArtifactSelectionState(nodeKeyRef.current).directNodeSelection);
      if (directNodeSelection) clearSelection();
    },
    [clearSelection, editable, editor],
  );

  const handleViewModeChange = useCallback((value: string | number) => {
    const nextMode = String(value);
    if (nextMode === 'code-only' || nextMode === 'preview-only' || nextMode === 'split') {
      setViewMode(nextMode);
      if (nextMode === 'preview-only') {
        queueMicrotask(() => {
          const preview = previewRef.current;
          if (!preview || preview.closest('[data-collaborative-target-locked="true"]')) return;
          preview.focus();
        });
      }
    }
  }, []);

  const handlePreviewMouseDown = useCallback((event: MouseEvent) => {
    event.stopPropagation();
    const preview = previewRef.current;
    if (!preview || preview.closest('[data-collaborative-target-locked="true"]')) return;
    preview.focus();
  }, []);

  const stopViewControlEvent = useCallback(
    (event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>) => {
      event.stopPropagation();
    },
    [],
  );

  if (!editable) {
    return (
      <div
        className={cx(artifactStyles, 'artifact-readonly', className)}
        contentEditable={false}
        style={
          {
            '--lobe-artifact-preview-height': `${previewHeight}px`,
          } as CSSProperties
        }
      >
        <div className="artifact-preview">
          <ArtifactPreview
            allowScripts={allowScripts}
            height={previewHeight}
            html={html}
            iframeRef={previewRef}
            title={title}
          />
        </div>
      </div>
    );
  }

  const showBlockSelection = !blockSelectionSuppressed && selectionState.covered;

  return (
    <div
      className={cx(artifactStyles, showBlockSelection && 'artifact-selected', className)}
      contentEditable={false}
      data-artifact-view-mode={viewMode}
      onMouseDown={handleMouseDown}
      style={
        {
          '--lobe-artifact-preview-height': `${previewHeight}px`,
        } as CSSProperties
      }
    >
      <div className="artifact-header" {...{ [BLOCK_MENU_ANCHOR_ATTRIBUTE]: 'center' }}>
        <div className="artifact-heading">
          <input
            aria-label={labels?.title || 'Artifact title'}
            className="artifact-title"
            onChange={handleTitleChange}
            onMouseDown={(event) => event.stopPropagation()}
            value={title}
          />
        </div>
        <div
          className="artifact-view-controls"
          onClick={stopViewControlEvent}
          onMouseDown={stopViewControlEvent}
          onPointerDown={stopViewControlEvent}
        >
          <div aria-label={labels?.viewMode || 'Artifact view'} className="artifact-view-mode">
            <Segmented
              aria-label={labels?.viewMode || 'Artifact view'}
              options={[
                {
                  label: (
                    <span className="artifact-view-option">
                      <Columns2 aria-hidden="true" size={13} />
                      {labels?.splitView || 'Split view'}
                    </span>
                  ),
                  value: 'split',
                },
                {
                  label: (
                    <span className="artifact-view-option">
                      <CodeXml aria-hidden="true" size={13} />
                      {labels?.codeOnly || 'Code only'}
                    </span>
                  ),
                  value: 'code-only',
                },
                {
                  label: (
                    <span className="artifact-view-option">
                      <Eye aria-hidden="true" size={13} />
                      {labels?.previewOnly || 'Preview only'}
                    </span>
                  ),
                  value: 'preview-only',
                },
              ]}
              size="small"
              value={viewMode}
              onChange={handleViewModeChange}
            />
          </div>
        </div>
      </div>
      <div
        className={cx(
          'artifact-body',
          viewMode === 'code-only' && 'artifact-code-only',
          viewMode === 'preview-only' && 'artifact-preview-only',
        )}
      >
        {viewMode !== 'preview-only' && (
          <div className="artifact-code" onMouseDown={handleCodeMouseDown}>
            <textarea
              aria-label={labels?.code || 'HTML source'}
              className={cx('cm-textarea', codeMirrorLoadFailed && 'artifact-code-fallback')}
              onChange={handleTextareaChange}
              ref={textareaRef}
              readOnly={!codeMirrorLoadFailed}
              style={codeMirrorLoadFailed ? { opacity: 1, resize: 'none' } : undefined}
              value={html}
            />
          </div>
        )}
        <div
          className={cx('artifact-preview', viewMode === 'code-only' && 'artifact-preview-hidden')}
          onMouseDown={handlePreviewMouseDown}
        >
          <ArtifactPreview
            allowScripts={allowScripts}
            height={previewHeight}
            html={html}
            iframeRef={previewRef}
            title={title}
          />
        </div>
      </div>
    </div>
  );
};

ArtifactView.displayName = 'ArtifactView';

export default ArtifactView;
