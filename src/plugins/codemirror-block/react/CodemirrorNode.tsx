'use client';

import { mergeRegister } from '@lexical/utils';
import { Block } from '@lobehub/ui';
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
import { type FC, useCallback, useEffect, useRef, useState } from 'react';

import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { lobeTheme } from '@/plugins/codemirror-block/react/theme';

import { SELECT_AFTER_CODEMIRROR_COMMAND, SELECT_BEFORE_CODEMIRROR_COMMAND } from '../command';
import { loadCodeMirror } from '../lib';
import { CodeMirrorNode } from '../node/CodeMirrorNode';
import { Toolbar } from './components/Toolbar';
import { styles } from './style';

interface ReactCodemirrorNodeProps {
  className?: string;
  editor: LexicalEditor;
  node: CodeMirrorNode;
}

const ReactCodemirrorNode: FC<ReactCodemirrorNodeProps> = ({ node, className, editor }) => {
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
        instanceRef.current.setOption('mode', value);
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
  }, [isSelected, isNodeSelected, editor]);

  useEffect(() => {
    if (ref.current) {
      const dom = ref.current;
      loadCodeMirror().then((CodeMirror) => {
        const instance = CodeMirror.fromTextArea(dom, {
          // keep options alphabetically ordered
          indentWithTabs: useTabs,
          lineNumbers: showLineNumbers,
          mode: node.lang,
          tabSize,
          theme: 'default',
          value: node.code,
        });

        console.info(instance);

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
      if (instanceRef.current) {
        instanceRef.current.destory();
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
      <div className={cx('cm-container', !expand && 'cm-container-collapsed')}>
        <textarea className={'cm-textarea'} ref={ref} />
      </div>
    </Block>
  );
};

ReactCodemirrorNode.displayName = 'ReactCodemirrorNode';

export default ReactCodemirrorNode;
