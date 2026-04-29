'use client';

import { mergeRegister } from '@lexical/utils';
import { Block, Mermaid } from '@lobehub/ui';
import { message } from 'antd';
import { cx } from 'antd-style';
import { debounce } from 'es-toolkit/compat';
import {
  $getSelection,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  KEY_DOWN_COMMAND,
  LexicalEditor,
} from 'lexical';
import {
  type FC,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { lobeTheme } from '@/plugins/codemirror-block/react/theme';

import { SELECT_AFTER_CODEMIRROR_COMMAND, SELECT_BEFORE_CODEMIRROR_COMMAND } from '../command';
import { loadCodeMirror } from '../lib';
import { resolveCodeMirrorMode } from '../lib/mode';
import { CodeMirrorNode } from '../node/CodeMirrorNode';
import { Toolbar } from './components/Toolbar';
import { styles } from './style';

function isLikelyInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest?.('button, a[href], [role="button"], input, textarea, select'));
}

interface ReactCodemirrorNodeProps {
  className?: string;
  editor: LexicalEditor;
  node: CodeMirrorNode;
}

const ReactCodemirrorNode: FC<ReactCodemirrorNodeProps> = ({ node, className, editor }) => {
  const blockShellRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const keydownRef = useRef('');
  const instanceRef = useRef<any>(null);
  const isEmptyRef = useRef<boolean>(false);
  const t = useTranslation();
  const [isSelected, setSelected, clearSelection, isNodeSelected] = useLexicalNodeSelection(
    node.getKey(),
  );
  const [selectedLang, setSelectedLang] = useState(node.lang || 'javascript');
  // use any to avoid strict typing on optional persistence fields
  const [tabSize, setTabSize] = useState<number>(node.options.tabSize ?? 2);
  const [useTabs, setUseTabs] = useState<boolean>(node.options.indentWithTabs ?? false);
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(
    node.options.lineNumbers ?? false,
  );
  const [expand, setExpand] = useState<boolean>(true);
  /** Live text for in-editor Mermaid preview (Codemirror only shows source; diagram is rendered here). */
  const [mermaidDiagramSource, setMermaidDiagramSource] = useState(node.code);
  /** Mermaid：点击编辑器内别处时隐藏源码区；点击本代码块区域内再展开。不使用 document，以免误判 Ant Select 浮层等为「外部」。 */
  const [mermaidShowSource, setMermaidShowSource] = useState(true);
  const mermaidPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCodeMirror = useMemo(
    () => expand && (selectedLang !== 'mermaid' || mermaidShowSource),
    [expand, mermaidShowSource, selectedLang],
  );

  /** Mermaid：单击图表区域切换放大预览（无悬浮按钮） */
  const [mermaidDiagramExpanded, setMermaidDiagramExpanded] = useState(false);

  useEffect(() => {
    if (selectedLang !== 'mermaid') {
      setMermaidShowSource(true);
      setMermaidDiagramExpanded(false);
    }
  }, [selectedLang]);

  useEffect(() => {
    if (selectedLang !== 'mermaid') return;

    let detach: (() => void) | undefined;

    const bind = (root: HTMLElement | null) => {
      detach?.();
      detach = undefined;
      if (!root) return;

      const onPointerDown = (e: PointerEvent | MouseEvent) => {
        const shell = blockShellRef.current;
        const target = e.target;
        if (!shell || !(target instanceof Node)) return;

        if (!root.contains(target)) return;

        /** 点击下方渲染区时由图表自己处理缩放，不在此恢复/收起源码 */
        if (
          selectedLang === 'mermaid' &&
          target instanceof Element &&
          target.closest('[data-cm-mermaid-chart-area="true"]')
        ) {
          return;
        }

        if (shell.contains(target)) {
          setMermaidShowSource(true);
          setExpand(true);
          return;
        }

        setMermaidShowSource(false);
        setMermaidDiagramExpanded(false);
        setExpand(false);
        instanceRef.current?.blur();
      };

      root.addEventListener('pointerdown', onPointerDown, true);
      detach = () => root.removeEventListener('pointerdown', onPointerDown, true);
    };

    bind(editor.getRootElement());

    const removeRootListener = editor.registerRootListener((rootElement) => {
      bind(rootElement as HTMLElement | null);
    });

    return () => {
      detach?.();
      removeRootListener();
    };
  }, [editor, selectedLang]);

  // 复制代码
  const handleCopy = useCallback(async () => {
    if (instanceRef.current) {
      const code = instanceRef.current.getValue();
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        message.error(t('codemirror.copyFailed'));
      }
    }
  }, [t]);

  // 更改语言
  const handleLanguageChange = useCallback(
    (value: string) => {
      setSelectedLang(value);
      if (instanceRef.current) {
        instanceRef.current.setOption('mode', resolveCodeMirrorMode(value));
      }
      editor.update(() => {
        node.setLang(value);
      });
    },
    [editor, node],
  );

  // 更改 tab 大小
  const handleTabSizeChange = useCallback(
    (value: number | null = 2) => {
      const v = value === null ? 2 : value;
      setTabSize(v);
      if (instanceRef.current) {
        instanceRef.current.setOption('tabSize', v);
      }
      editor.update(() => {
        node.setTabSize(v);
      });
    },
    [editor, node],
  );

  // 更改是否使用制表符
  const handleUseTabsChange = useCallback(
    (checked: boolean) => {
      setUseTabs(checked);
      if (instanceRef.current) {
        instanceRef.current.setOption('indentWithTabs', checked);
      }
      editor.update(() => {
        node.setIndentWithTabs(checked);
      });
    },
    [editor, node],
  );

  const handleShowLineNumbersChange = useCallback(
    (checked: boolean) => {
      setShowLineNumbers(checked);
      if (instanceRef.current) {
        instanceRef.current.setOption('lineNumbers', checked);
      }
      editor.update(() => {
        node.setLineNumbers(checked);
      });
    },
    [editor, node],
  );

  /** Toolbar 收起/展开与 Mermaid 源码隐藏解耦：用箭头重新展开时需恢复源码区 */
  const toggleCodePanel = useCallback(() => {
    setExpand((prev) => {
      const next = !prev;
      if (selectedLang === 'mermaid' && next) {
        setMermaidShowSource(true);
      }
      return next;
    });
  }, [selectedLang]);

  /** 单击图表（非控件）切换放大预览 */
  const handleMermaidDiagramClick = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const el = e.target;
    if (!(el instanceof Element)) return;
    if (isLikelyInteractiveTarget(el)) return;
    e.stopPropagation();
    setMermaidDiagramExpanded((v) => !v);
  }, []);

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
    // Mermaid 收起源码时不高亮抢焦点 CodeMirror（用户在看图）
    if (selectedLang === 'mermaid' && !showCodeMirror) {
      return;
    }
    // 选中状态下，聚焦 CodeMirror
    if (isSelected && instanceRef.current && isNodeSelected) {
      // 已经聚焦不在处理
      if (instanceRef.current?.view.hasFocus) {
        return;
      }
      instanceRef.current.focus();
      if (keydownRef.current === 'end') {
        instanceRef.current.setSelectionToEnd();
      }
    }
  }, [isSelected, isNodeSelected, editor, selectedLang, showCodeMirror]);

  useEffect(() => {
    if (selectedLang !== 'mermaid' || !instanceRef.current) return;
    setMermaidDiagramSource(instanceRef.current.getValue());
  }, [selectedLang]);

  useEffect(() => {
    // 防止重复初始化：如果已经有实例，直接返回
    if (instanceRef.current) {
      return;
    }

    if (ref.current) {
      const dom = ref.current;
      loadCodeMirror().then((CodeMirror) => {
        // 双重检查：在异步操作后再次确认没有重复初始化
        if (instanceRef.current) {
          return;
        }

        const instance = CodeMirror.fromTextArea(dom, {
          // keep options alphabetically ordered
          indentWithTabs: useTabs,
          lineNumbers: showLineNumbers,
          mode: resolveCodeMirrorMode(node.lang),
          tabSize,
          theme: 'default',
          value: node.code,
        });

        instance.view.dispatch({
          effects: instance.optionHelper.theme.reconfigure(
            instance.view.constructor.theme(lobeTheme, {
              dark: false,
            }),
          ),
        });

        // 初始化 isEmptyRef 的值
        isEmptyRef.current = !node.code.trim();

        instance.on('keydown', (instance, e) => {
          e.stopPropagation();

          // Cmd+Enter / Ctrl+Enter: exit codeblock (move caret after the block)
          if ((e.key === 'Enter' || e.keyCode === 13) && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            instanceRef.current?.blur();
            editor.dispatchCommand(SELECT_AFTER_CODEMIRROR_COMMAND, { key: node.getKey() });
            queueMicrotask(() => {
              editor.focus();
            });
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
              const prevNode = node.getPreviousSibling();
              node.remove();
              // 如果有前一个节点，选择它的末尾
              if (prevNode) {
                const prevSelection = prevNode.selectEnd();
                if (prevSelection) {
                  $setSelection(prevSelection);
                }
              }
            });
            // 将焦点返回到编辑器
            queueMicrotask(() => {
              editor.focus();
            });
          }
        });

        instance.on('leftOut', () => {
          instanceRef.current?.blur();
          editor.dispatchCommand(SELECT_BEFORE_CODEMIRROR_COMMAND, { key: node.getKey() });
          queueMicrotask(() => {
            editor.focus();
          });
        });
        instance.on('rightOut', () => {
          instanceRef.current?.blur();
          editor.dispatchCommand(SELECT_AFTER_CODEMIRROR_COMMAND, { key: node.getKey() });
          queueMicrotask(() => {
            editor.focus();
          });
        });

        instance.on('change', () => {
          const currentValue = instance.getValue();
          // 立即检查代码是否为空（trim 后为空），用于 keydown 事件判断
          isEmptyRef.current = !currentValue.trim();

          if (mermaidPreviewTimerRef.current) {
            clearTimeout(mermaidPreviewTimerRef.current);
          }
          mermaidPreviewTimerRef.current = setTimeout(() => {
            setMermaidDiagramSource(currentValue);
            mermaidPreviewTimerRef.current = null;
          }, 220);
        });

        instance.on(
          'change',
          debounce(() => {
            const currentValue = instance.getValue();
            // 更新代码内容
            editor.update(() => {
              node.setCode(currentValue);
            });
          }),
        );
        instance.on('focus', () => {
          if (
            editor.getEditorState().read(() => {
              const sel = $getSelection();
              if (!sel) return false;
              if (sel?.getNodes().length > 1 || !sel?.getNodes().includes(node)) {
                return true;
              }
              return false;
            })
          ) {
            setSelected(true);
          }
        });

        instanceRef.current = instance;
        if (isSelected) {
          instanceRef.current.focus();
        }
      });
    }

    return () => {
      if (mermaidPreviewTimerRef.current) {
        clearTimeout(mermaidPreviewTimerRef.current);
        mermaidPreviewTimerRef.current = null;
      }
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
    };
  }, [ref]);

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

  return (
    <div ref={blockShellRef}>
      <Block
        className={cx(styles, isSelected && !isNodeSelected && 'selected', className)}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onSelect={(e) => e.stopPropagation()}
        variant={'filled'}
      >
        {/* 工具条 */}
        <Toolbar
          expand={expand}
          onClick={toggleCodePanel}
          onCopy={handleCopy}
          onLanguageChange={handleLanguageChange}
          onShowLineNumbersChange={handleShowLineNumbersChange}
          onTabSizeChange={handleTabSizeChange}
          onUseTabsChange={handleUseTabsChange}
          selectedLang={selectedLang}
          showLineNumbers={showLineNumbers}
          tabSize={tabSize}
          toggleExpand={toggleCodePanel}
          useTabs={useTabs}
        />

        {/* CodeMirror 在上方；Mermaid 预览在下方单独区域（非代码块正文内） */}
        <div className={cx('cm-container', !showCodeMirror && 'cm-container-collapsed')}>
          <textarea className={'cm-textarea'} ref={ref} />
        </div>

        {selectedLang === 'mermaid' && mermaidDiagramSource.trim().length > 0 && (
          <div className={'cm-mermaid-preview'} data-cm-mermaid-chart-area="true">
            <div className={'cm-mermaid-chart-area'} onClick={handleMermaidDiagramClick}>
              <div
                className={cx(
                  'cm-mermaid-render',
                  mermaidDiagramExpanded && 'cm-mermaid-render-expanded',
                )}
              >
                <Mermaid
                  animated={false}
                  fullFeatured={false}
                  showLanguage={true}
                  theme="lobe-theme"
                  variant="filled"
                >
                  {mermaidDiagramSource.trim()}
                </Mermaid>
              </div>
            </div>
          </div>
        )}
      </Block>
    </div>
  );
};

ReactCodemirrorNode.displayName = 'ReactCodemirrorNode';

export default ReactCodemirrorNode;
