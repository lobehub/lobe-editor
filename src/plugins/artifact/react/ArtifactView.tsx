'use client';

import { cx } from 'antd-style';
import { debounce } from 'es-toolkit/compat';
import type { LexicalEditor } from 'lexical';
import { $getNodeByKey, COMMAND_PRIORITY_HIGH } from 'lexical';
import type { ChangeEvent, CSSProperties, FC, MouseEvent } from 'react';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import type { ICodeMirrorInstance } from '@/codemirror';
import { loadCodeMirror, lobeTheme } from '@/codemirror';
import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';
import { BLOCK_MENU_ANCHOR_ATTRIBUTE } from '@/plugins/block/react/core/types';
import { ENTER_HOLE_CONTENT_COMMAND } from '@/plugins/common/command';

import {
  SELECT_AFTER_ARTIFACT_COMMAND,
  SELECT_BEFORE_ARTIFACT_COMMAND,
} from '../command';
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

const ArtifactView: FC<ArtifactViewProps> = ({
  allowScripts,
  className,
  editor,
  labels,
  node,
  previewHeight,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    if (!editable || !textareaRef.current) {
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
  }, [editable, editor]);

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
          <span>{labels?.code || 'HTML'}</span>
        </div>
        <div className="artifact-heading">{labels?.preview || 'Preview'}</div>
      </div>
      <div className="artifact-body">
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
        <div className="artifact-preview" onMouseDown={(event) => event.stopPropagation()}>
          <ArtifactPreview
            allowScripts={allowScripts}
            height={previewHeight}
            html={html}
            title={title}
          />
        </div>
      </div>
    </div>
  );
};

ArtifactView.displayName = 'ArtifactView';

export default ArtifactView;
