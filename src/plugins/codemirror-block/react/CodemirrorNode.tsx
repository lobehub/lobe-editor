'use client';

import { mergeRegister } from '@lexical/utils';
import { ActionIcon, Block } from '@lobehub/ui';
import { cx } from 'antd-style';
import { debounce } from 'es-toolkit/compat';
import type { LexicalEditor } from 'lexical';
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
} from 'lexical';
import { CodeXml, Eye } from 'lucide-react';
import {
  type FC,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { lobeTheme, styles, Toolbar } from '@/codemirror';
import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { ENTER_HOLE_CONTENT_COMMAND, getHoleContentEntrySide } from '@/plugins/common/command';
import { $resolveStructuralBlockNode } from '@/plugins/common/node/hole';
import { createDebugLogger } from '@/utils/debug';

import { SELECT_AFTER_CODEMIRROR_COMMAND, SELECT_BEFORE_CODEMIRROR_COMMAND } from '../command';
import { loadCodeMirror } from '../lib';
import { normalizeCodeMirrorLanguage } from '../lib/mode';
import type { CodeMirrorNode } from '../node/CodeMirrorNode';
import MermaidPreview from './MermaidPreview';
import { useCodemirrorEditLock } from './useCodemirrorEditLock';

interface ReactCodemirrorNodeProps {
  className?: string;
  editor: LexicalEditor;
  node: CodeMirrorNode;
}

type CancellableCallback = (() => void) & { cancel: () => void };

const logger = createDebugLogger('plugin', 'codemirror-block');

const ReactCodemirrorNode: FC<ReactCodemirrorNodeProps> = ({ node, className, editor }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const keydownRef = useRef('');
  const instanceRef = useRef<any>(null);
  const nodeKey = node.getKey();
  const nodeRef = useRef(node);
  nodeRef.current = node;
  const enteringFromHoleRef = useRef(false);
  const isEmptyRef = useRef<boolean>(false);
  const hasLocalEditLockRef = useRef(false);
  const releaseLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeMirrorGenerationRef = useRef(0);
  const isMountedRef = useRef(false);
  const pendingCodeUpdateRef = useRef<CancellableCallback | null>(null);
  const t = useTranslation();
  const [isSelected, setSelected, clearSelection, isNodeSelected] =
    useLexicalNodeSelection(nodeKey);
  const initialLanguage = normalizeCodeMirrorLanguage(node.lang) || 'plain';
  const [selectedLang, setSelectedLang] = useState(initialLanguage);
  // use any to avoid strict typing on optional persistence fields
  const [tabSize, setTabSize] = useState<number>(node.options.tabSize ?? 2);
  const [useTabs, setUseTabs] = useState<boolean>(node.options.indentWithTabs ?? false);
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(
    node.options.lineNumbers ?? false,
  );
  const [expand, setExpand] = useState<boolean>(true);
  const [preview, setPreview] = useState<boolean>(false);
  const [code, dispatchCode] = useReducer((_state: string, value: string) => value, node.code);
  const [, setEditableRevision] = useState(0);
  const editable = editor.isEditable();
  const nodeCodeRef = useRef(node.code);
  const nodeLangRef = useRef(initialLanguage);
  const { acquireLock, isLockedByRemote, lockOwnerName, releaseLock } = useCodemirrorEditLock(
    nodeKey,
    'CodeMirror block',
  );
  const editLockRef = useRef({ acquireLock, isLockedByRemote, releaseLock });
  const effectiveReadOnly = !editable || isLockedByRemote;
  const remoteLockRef = useRef(isLockedByRemote);
  remoteLockRef.current = isLockedByRemote;

  // Read editor.isEditable() at the point of a mutation as well as from the
  // subscribed React state. Lexical can notify listeners before React has
  // committed the corresponding render.
  const canWriteNow = useCallback(() => editor.isEditable() && !remoteLockRef.current, [editor]);

  useEffect(() => {
    // The current owner is read directly during render. The listener only
    // invalidates that snapshot when the same owner changes its mode.
    return editor.registerEditableListener(() => {
      setEditableRevision((revision) => revision + 1);
    });
  }, [editor]);

  useEffect(() => {
    editLockRef.current = { acquireLock, isLockedByRemote, releaseLock };
  }, [acquireLock, isLockedByRemote, releaseLock]);

  const clearReleaseLockTimer = useCallback(() => {
    if (!releaseLockTimerRef.current) return;
    clearTimeout(releaseLockTimerRef.current);
    releaseLockTimerRef.current = null;
  }, []);

  const acquireEditLock = useCallback(() => {
    clearReleaseLockTimer();
    const acquired = editLockRef.current.acquireLock();
    if (acquired) hasLocalEditLockRef.current = true;
    return acquired;
  }, [clearReleaseLockTimer]);

  const releaseEditLock = useCallback(() => {
    clearReleaseLockTimer();
    if (!hasLocalEditLockRef.current) return;
    editLockRef.current.releaseLock();
    hasLocalEditLockRef.current = false;
  }, [clearReleaseLockTimer]);

  const scheduleReleaseEditLock = useCallback(() => {
    clearReleaseLockTimer();
    releaseLockTimerRef.current = setTimeout(() => {
      releaseLockTimerRef.current = null;
      if (document.visibilityState === 'hidden' || instanceRef.current?.view.hasFocus) return;
      releaseEditLock();
    }, 100);
  }, [clearReleaseLockTimer, releaseEditLock]);

  const handleCopy = useCallback(async () => {
    if (instanceRef.current) {
      const code = instanceRef.current.getValue();
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        /* swallow */
      }
    }
  }, []);

  const labels = useMemo(
    () => ({
      preview: t('codemirror.preview'),
      selectLanguage: t('codemirror.selectLanguage'),
      showLineNumbers: t('codemirror.showLineNumbers'),
      tabSize: t('codemirror.tabSize'),
      useTabs: t('codemirror.useTabs'),
    }),
    [t],
  );

  // 更改语言
  const handleLanguageChange = useCallback(
    (value: string) => {
      if (!canWriteNow()) return;
      setSelectedLang(value);
      if (value !== 'mermaid') {
        setPreview(false);
      }
      if (instanceRef.current) {
        instanceRef.current.setOption('mode', value);
      }
      editor.update(() => {
        node.setLang(value);
      });
    },
    [canWriteNow, editor, node],
  );

  // 更改 tab 大小
  const handleTabSizeChange = useCallback(
    (value: number | null = 2) => {
      if (!canWriteNow()) return;
      const v = value === null ? 2 : value;
      setTabSize(v);
      if (instanceRef.current) {
        instanceRef.current.setOption('tabSize', v);
      }
      editor.update(() => {
        node.setTabSize(v);
      });
    },
    [canWriteNow, editor, node],
  );

  // 更改是否使用制表符
  const handleUseTabsChange = useCallback(
    (checked: boolean) => {
      if (!canWriteNow()) return;
      setUseTabs(checked);
      if (instanceRef.current) {
        instanceRef.current.setOption('indentWithTabs', checked);
      }
      editor.update(() => {
        node.setIndentWithTabs(checked);
      });
    },
    [canWriteNow, editor, node],
  );

  const handleShowLineNumbersChange = useCallback(
    (checked: boolean) => {
      if (!canWriteNow()) return;
      setShowLineNumbers(checked);
      if (instanceRef.current) {
        instanceRef.current.setOption('lineNumbers', checked);
      }
      editor.update(() => {
        node.setLineNumbers(checked);
      });
    },
    [canWriteNow, editor, node],
  );

  useEffect(() => {
    const nextLanguage = normalizeCodeMirrorLanguage(node.lang) || 'plain';
    const changedInEditor = nextLanguage !== nodeLangRef.current;
    nodeLangRef.current = nextLanguage;
    if (!changedInEditor) return;

    setSelectedLang(nextLanguage);
    instanceRef.current?.setOption('mode', nextLanguage);
  }, [node]);

  // The block rewrite command updates the Lexical CodeMirrorNode from a
  // collaborative/headless editor. CodeMirror owns its rendered document, so
  // a React decorator rerender alone does not update the visible editor.
  // Mirror external node changes into the live instance while leaving local
  // CodeMirror edits on their existing debounced persistence path.
  useEffect(() => {
    const nextCode = node.code;
    const changedInEditor = nextCode !== nodeCodeRef.current;
    nodeCodeRef.current = nextCode;
    if (!changedInEditor) return;

    isEmptyRef.current = !nextCode.trim();
    dispatchCode(nextCode);
    if (instanceRef.current && instanceRef.current.getValue() !== nextCode) {
      instanceRef.current.setValue(nextCode);
    }
  }, [node]);

  useEffect(() => {
    const sel = editor.getEditorState().read(() => $getSelection());
    // 鼠标主动点击导致的选中，不处理
    if (instanceRef.current?.view.hasFocus && sel === null) {
      return;
    }
    // 选区移走
    if (!isSelected || !isNodeSelected) {
      if (instanceRef.current) {
        instanceRef.current.blur();
      }
      return;
    }
    // An outer read-only editor may still select text in CodeMirror, but it
    // must not acquire a collaborative edit lease just because the decorator
    // is selected.
    if (!editable) return;
    // 选中状态下，聚焦 CodeMirror
    if (isSelected && instanceRef.current && isNodeSelected) {
      if (!acquireEditLock()) {
        clearSelection();
        return;
      }
      // 已经聚焦不在处理
      if (instanceRef.current?.view.hasFocus) {
        return;
      }
      instanceRef.current.focus();
      if (keydownRef.current === 'end') {
        instanceRef.current.setSelectionToEnd();
      }
    }
  }, [acquireEditLock, clearSelection, editable, editor, isNodeSelected, isSelected]);

  useEffect(() => {
    // 防止重复初始化：如果已经有实例，直接返回
    if (instanceRef.current) {
      return;
    }

    const dom = ref.current;
    if (!dom) return;

    const generation = ++codeMirrorGenerationRef.current;
    let disposed = false;
    let pendingCodeUpdate: CancellableCallback | null = null;
    isMountedRef.current = true;

    const isCurrent = () =>
      !disposed &&
      isMountedRef.current &&
      codeMirrorGenerationRef.current === generation &&
      ref.current === dom;
    const destroyInstance = (instance: any) => {
      try {
        instance?.destroy();
      } catch {
        // CodeMirror may already have detached its view during unmount.
      }
    };

    void loadCodeMirror()
      .then((CodeMirror) => {
        // StrictMode can resolve the first mount's loader after its cleanup.
        // Only the current generation is allowed to create an instance.
        if (!isCurrent() || instanceRef.current) return;

        let instance: any = null;
        try {
          instance = CodeMirror.fromTextArea(dom, {
            // keep options alphabetically ordered
            indentWithTabs: useTabs,
            lineNumbers: showLineNumbers,
            mode: nodeLangRef.current,
            readOnly: !canWriteNow(),
            tabSize,
            theme: 'default',
            // The decorator may receive a remote rewrite while the lazy
            // CodeMirror loader is still pending. Read the latest mirrored
            // value instead of the effect's initial node closure.
            value: nodeCodeRef.current,
          });

          if (!isCurrent()) {
            destroyInstance(instance);
            return;
          }

          instance.view.dispatch({
            effects: instance.optionHelper.theme.reconfigure(
              instance.view.constructor.theme(lobeTheme, {
                dark: false,
              }),
            ),
          });

          // 初始化 isEmptyRef 的值
          isEmptyRef.current = !nodeCodeRef.current.trim();

          instance.on('keydown', (instance: any, e: KeyboardEvent) => {
            if (!isCurrent()) return;
            e.stopPropagation();

            const isExitCommand =
              (e.key === 'Enter' || e.keyCode === 13) && (e.metaKey || e.ctrlKey);
            if (isExitCommand) {
              e.preventDefault();
              if (!canWriteNow()) return;
              instanceRef.current?.blur();
              editor.dispatchCommand(SELECT_AFTER_CODEMIRROR_COMMAND, { key: nodeKey });
              queueMicrotask(() => {
                if (isCurrent()) editor.focus();
              });
              return;
            }

            // CodeMirror blocks normal input while read-only. Explicitly
            // consume destructive keys as well so the empty-block shortcut
            // cannot remove a Lexical node behind CodeMirror's read-only view.
            if (!canWriteNow()) {
              if (e.key === 'Backspace' || e.keyCode === 8 || e.key === 'Delete') {
                e.preventDefault();
              }
              return;
            }

            // 当代码块为空且按退格键时，删除代码块节点
            if (e.key === 'Backspace' || e.keyCode === 8) {
              // 检查代码内容是否为空（使用 ref 中存储的状态）
              if (!isEmptyRef.current) {
                return;
              }

              e.preventDefault();
              editor.update(() => {
                const structuralNode = $resolveStructuralBlockNode(nodeRef.current);
                const structuralParent = structuralNode.getParent();
                const prevNode = structuralNode.getPreviousSibling();
                const nextNode = structuralNode.getNextSibling();
                structuralNode.remove();
                // 如果有前一个节点，选择它的末尾
                if (prevNode) {
                  const prevSelection = prevNode.selectEnd();
                  if (prevSelection) {
                    $setSelection(prevSelection);
                  }
                } else if (nextNode) {
                  const nextSelection = nextNode.selectStart();
                  if (nextSelection) {
                    $setSelection(nextSelection);
                  }
                } else if (structuralParent && $isElementNode(structuralParent)) {
                  const paragraph = $createParagraphNode();
                  structuralParent.append(paragraph);
                  paragraph.selectStart();
                }
              });
              // 将焦点返回到编辑器
              queueMicrotask(() => {
                if (isCurrent()) editor.focus();
              });
            }
          });

          instance.on('leftOut', () => {
            if (!isCurrent()) return;
            instanceRef.current?.blur();
            editor.dispatchCommand(SELECT_BEFORE_CODEMIRROR_COMMAND, { key: nodeKey });
            queueMicrotask(() => {
              if (isCurrent()) editor.focus();
            });
          });
          instance.on('rightOut', () => {
            if (!isCurrent()) return;
            instanceRef.current?.blur();
            editor.dispatchCommand(SELECT_AFTER_CODEMIRROR_COMMAND, { key: nodeKey });
            queueMicrotask(() => {
              if (isCurrent()) editor.focus();
            });
          });

          instance.on('change', () => {
            if (!isCurrent() || !canWriteNow()) return;
            const currentValue = instance.getValue();
            // 立即检查代码是否为空（trim 后为空），用于 keydown 事件判断
            isEmptyRef.current = !currentValue.trim();
            dispatchCode(currentValue);
          });

          pendingCodeUpdate = debounce(() => {
            if (!isCurrent() || !canWriteNow()) return;
            const currentValue = instance.getValue();
            // 更新代码内容
            editor.update(() => {
              if (canWriteNow()) nodeRef.current.setCode(currentValue);
            });
          });
          pendingCodeUpdateRef.current = pendingCodeUpdate;
          instance.on('change', pendingCodeUpdate);
          instance.on('focus', () => {
            if (!isCurrent() || enteringFromHoleRef.current) return;

            // A remote lease owns the block, so focusing it must still be
            // rejected. Outer editor read-only only disables writes and keeps
            // normal CodeMirror text selection available.
            if (remoteLockRef.current) {
              instanceRef.current?.blur();
              clearSelection();
              return;
            }
            if (canWriteNow() && !acquireEditLock()) {
              instanceRef.current?.blur();
              clearSelection();
              return;
            }

            if (
              editor.getEditorState().read(() => {
                const sel = $getSelection();
                if (!sel) return false;
                if (sel?.getNodes().length > 1 || !sel?.getNodes().includes(nodeRef.current)) {
                  return true;
                }
                return false;
              })
            ) {
              setSelected(true);
            }
          });
          instance.on('blur', scheduleReleaseEditLock);

          if (!isCurrent()) {
            pendingCodeUpdate.cancel();
            if (pendingCodeUpdateRef.current === pendingCodeUpdate) {
              pendingCodeUpdateRef.current = null;
            }
            destroyInstance(instance);
            return;
          }

          instanceRef.current = instance;
          if (isSelected && canWriteNow() && acquireEditLock()) {
            instanceRef.current.focus();
          }
        } catch (error) {
          pendingCodeUpdate?.cancel();
          if (pendingCodeUpdateRef.current === pendingCodeUpdate) {
            pendingCodeUpdateRef.current = null;
          }
          if (instanceRef.current === instance) {
            instanceRef.current = null;
          }
          destroyInstance(instance);
          if (isCurrent()) {
            logger.error('Failed to initialize CodeMirror block', error);
          }
        }
      })
      .catch((error) => {
        if (isCurrent()) {
          logger.error('Failed to load CodeMirror block', error);
        }
      });

    return () => {
      disposed = true;
      isMountedRef.current = false;
      if (codeMirrorGenerationRef.current === generation) {
        codeMirrorGenerationRef.current += 1;
      }
      pendingCodeUpdateRef.current?.cancel();
      pendingCodeUpdateRef.current = null;
      pendingCodeUpdate?.cancel();
      clearReleaseLockTimer();
      releaseEditLock();
      const instance = instanceRef.current;
      instanceRef.current = null;
      destroyInstance(instance);
    };
    // This effect owns one CodeMirror instance per editor/node owner. Its event
    // handlers intentionally retain that owner while refs carry live values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canWriteNow, editor, nodeKey, ref]);

  useEffect(
    () =>
      editor.registerCommand(
        ENTER_HOLE_CONTENT_COMMAND,
        (payload) => {
          const side = getHoleContentEntrySide(payload);
          if (!canWriteNow() || !side || payload.key !== nodeKey) {
            return false;
          }

          const instance = instanceRef.current;
          if (!instance || !acquireEditLock()) return false;

          enteringFromHoleRef.current = true;
          const generation = codeMirrorGenerationRef.current;
          queueMicrotask(() => {
            if (isMountedRef.current && codeMirrorGenerationRef.current === generation) {
              enteringFromHoleRef.current = false;
            }
          });
          try {
            instance.focus();
            if (side === 'before') instance.setSelectionToStart();
            else instance.setSelectionToEnd();
            // CodeMirror owns the accepted caret; clear the stale outer
            // Lexical boundary only after the transfer succeeds. Normal
            // command dispatch already provides the update scope.
            $setSelection(null);
            return true;
          } catch {
            releaseEditLock();
            return false;
          }
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [acquireEditLock, canWriteNow, editor, nodeKey, releaseEditLock],
  );

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (payload) => {
          // console.info('KEY_DOWN_COMMAND:', payload, keydownRef.current);
          if (payload.key === 'ArrowLeft' || payload.key === 'ArrowUp') {
            keydownRef.current = 'end';
          } else {
            keydownRef.current = '';
          }
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
  }, [clearSelection, editor, isSelected, node, setSelected]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !instanceRef.current?.view.hasFocus) {
        releaseEditLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [releaseEditLock]);

  useEffect(() => {
    instanceRef.current?.setOption('readOnly', effectiveReadOnly);
    if (effectiveReadOnly) {
      // A change queued while writable must not land after either the outer
      // editor or the collaborative block becomes read-only.
      pendingCodeUpdateRef.current?.cancel();
    }
    if (isLockedByRemote) {
      releaseEditLock();
      instanceRef.current?.blur();
      clearSelection();
    } else if (!editable) {
      // Outer read-only does not own the remote lease, but it must give up a
      // local lease before the editor stops accepting writes.
      releaseEditLock();
    } else if (
      canWriteNow() &&
      instanceRef.current?.view.hasFocus &&
      !hasLocalEditLockRef.current &&
      !acquireEditLock()
    ) {
      // Read-only can be toggled while CodeMirror remains focused for text
      // selection. Reacquire the local lease before allowing writes again.
      instanceRef.current.blur();
      clearSelection();
    }
  }, [
    acquireEditLock,
    canWriteNow,
    clearSelection,
    editable,
    effectiveReadOnly,
    isLockedByRemote,
    releaseEditLock,
  ]);

  const handleBlockMouseDown = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      if (!isLockedByRemote) return;
      event.preventDefault();
      instanceRef.current?.blur();
      clearSelection();
    },
    [clearSelection, isLockedByRemote],
  );

  return (
    <Block
      className={cx(
        styles,
        isSelected && !isNodeSelected && 'selected',
        isLockedByRemote && 'collab-locked',
        className,
      )}
      onMouseDown={handleBlockMouseDown}
      onMouseUp={(e) => e.stopPropagation()}
      onSelect={(e) => e.stopPropagation()}
      variant={'filled'}
    >
      {isLockedByRemote && (
        <div className={'cm-collab-lock'} contentEditable={false}>
          {lockOwnerName || 'Someone'} editing
        </div>
      )}

      {/* 工具条 */}
      <Toolbar
        disabled={effectiveReadOnly}
        expand={expand}
        extra={
          selectedLang === 'mermaid' ? (
            <ActionIcon
              className={'cm-hidden-actions'}
              icon={preview ? CodeXml : Eye}
              onClick={() => setPreview(!preview)}
              size="small"
              title={labels.preview}
            />
          ) : undefined
        }
        labels={labels}
        onClick={() => setExpand(!expand)}
        onCopy={handleCopy}
        onLanguageChange={handleLanguageChange}
        onShowLineNumbersChange={handleShowLineNumbersChange}
        onTabSizeChange={handleTabSizeChange}
        onUseTabsChange={handleUseTabsChange}
        selectedLang={selectedLang}
        showLineNumbers={showLineNumbers}
        tabSize={tabSize}
        toggleExpand={() => setExpand(!expand)}
        useTabs={useTabs}
      />

      {/* CodeMirror 编辑器容器 */}
      <div
        className={cx(
          'cm-container',
          (!expand || (preview && selectedLang === 'mermaid')) && 'cm-container-collapsed',
        )}
      >
        <textarea className={'cm-textarea'} ref={ref} />
      </div>

      {expand && preview && selectedLang === 'mermaid' && (
        <div className={'cm-container'} onMouseDown={(e) => e.stopPropagation()}>
          <MermaidPreview code={code} />
        </div>
      )}
    </Block>
  );
};

ReactCodemirrorNode.displayName = 'ReactCodemirrorNode';

export default ReactCodemirrorNode;
