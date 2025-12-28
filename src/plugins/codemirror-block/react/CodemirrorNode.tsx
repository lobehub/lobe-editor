'use client';

import { mergeRegister } from '@lexical/utils';
import { Block } from '@lobehub/ui';
import { message } from 'antd';
import { cx } from 'antd-style';
import { debounce } from 'es-toolkit/compat';
import { $getSelection, COMMAND_PRIORITY_CRITICAL, KEY_DOWN_COMMAND, LexicalEditor } from 'lexical';
import { type FC, useCallback, useEffect, useRef, useState } from 'react';

import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

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
  const t = useTranslation();
  const [isSelected, setSelected, clearSelection, isNodeSelected] = useLexicalNodeSelection(
    node.getKey(),
  );
  const [selectedTheme, setSelectedTheme] = useState('One Dark Pro');
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
        message.success(t('codemirror.copySuccess'));
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

  // 更改主题
  const handleThemeChange = useCallback(
    (value: string) => {
      setSelectedTheme(value);
      if (instanceRef.current) {
        instanceRef.current.setOption('theme', value);
      }
      editor.update(() => {
        node.setCodeTheme(value);
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
          theme: 'One Dark Pro',
          value: node.code,
        });

        console.info(instance);

        instance.view.dispatch({
          effects: instance.optionHelper.theme.reconfigure(
            instance.view.constructor.theme(
              {
                '&': {
                  '& .cm-cursor': {
                    'border-left-color': '#286ada',
                  },
                  '& .cm-gutters': {
                    'background-color': '#fafafa',
                    'border': 'none',
                  },
                  '& .cm-line': {
                    '& .box-css .cm-tag': {
                      color: '#22863a',
                    },
                    '& .box-html .cm-atom': {
                      color: '#004fb4',
                    },
                    '& .cm-atom': {
                      color: '#905',
                    },
                    '& .cm-attribute': {
                      color: '#6f42c1',
                    },
                    '& .cm-builtin': {
                      color: '#6f42c1',
                    },
                    '& .cm-comment': {
                      color: '#6a737d',
                    },
                    '& .cm-foldPlaceholder': {
                      'background': `url("data:image/svg+xml,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Crect fill='%23E8E8E8' width='16' height='16' rx='2'/%3E%3Cpath d='M2.75 7.984a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm4.375 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm4.375 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z' fill='%232A3238'/%3E%3C/g%3E%3C/svg%3E") no-repeat`,
                      'border': 'none',
                      'color': 'transparent',
                      'display': 'inline-block',
                      'height': '16px',
                      'padding': 0,
                      'vertical-align': 'middle',
                      'width': '16px',
                    },
                    '& .cm-header': {
                      color: 'blue',
                    },
                    '& .cm-keyword': {
                      color: '#d73a49',
                    },
                    '& .cm-meta': {
                      color: '#1f7f9a',
                    },
                    '& .cm-number': {
                      color: '#005cc5',
                    },
                    '& .cm-operator': {
                      color: '#e10023',
                    },
                    '& .cm-property': {
                      color: '#005cc5',
                    },
                    '& .cm-qualifier': {
                      color: '#555',
                    },
                    '& .cm-string': {
                      color: '#690',
                    },
                    '& .cm-string-2': {
                      color: '#690',
                    },
                    '& .cm-tag': {
                      color: '#22863a',
                    },
                    '& .cm-tag.cm-bracket': {
                      color: '#997',
                    },
                    '& .cm-variable': {
                      color: '#232930',
                    },
                    '& .cm-variable-2': {
                      color: '#005cc5',
                    },
                    '& .cm-variable-3': {
                      color: '#22863a',
                    },
                    '& .cm-variable.cm-callee': {
                      color: '#3ef231',
                    },
                    '& .cm-variable.cm-def': {
                      color: '#a13000',
                    },
                    'color': '#262626',
                  },
                },
                '& .cm-selectionMatch': {
                  background: 'rgba(80, 153, 236, 0.5)',
                },
                '&.cm-editor': {
                  background: '#fafafa',
                },
                '&.cm-editor.cm-focused .cm-selectionBackground': {
                  background: 'rgba(80, 153, 236, 0.5)',
                },
                '&.cm-editor.cm-focused .cm-selectionLineGutter': {
                  color: '#000',
                },
              },
              {
                dark: false,
              },
            ),
          ),
        });

        instance.on('keydown', (instance, e) => {
          e.stopPropagation();
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

        instance.on(
          'change',
          debounce(() => {
            editor.update(() => {
              node.setCode(instance.getValue());
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
        onThemeChange={handleThemeChange}
        onUseTabsChange={handleUseTabsChange}
        selectedLang={selectedLang}
        selectedTheme={selectedTheme}
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
