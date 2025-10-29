'use client';

import { mergeRegister } from '@lexical/utils';
import { Button, Select, message } from 'antd';
import { $getSelection, COMMAND_PRIORITY_CRITICAL, KEY_DOWN_COMMAND, LexicalEditor } from 'lexical';
import { debounce } from 'lodash';
import { Copy } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';

import { SELECT_AFTER_CODEMIRROR_COMMAND, SELECT_BEFORE_CODEMIRROR_COMMAND } from '../command';
import { loadCodeMirror } from '../lib';
import { MODES, THEMES } from '../lib/mode';
import { CodeMirrorNode } from '../node/CodeMirrorNode';
import { useStyles } from './style';

interface ReactCodemirrorNodeProps {
  className?: string;
  editor: LexicalEditor;
  node: CodeMirrorNode;
}

const ReactCodemirrorNode = memo<ReactCodemirrorNodeProps>(({ node, className, editor }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const keydownRef = useRef('');
  const instanceRef = useRef<any>(null);
  const [isSelectFocused, setSelectFocused] = useState(false);
  const [isFocused, setFocused] = useState(false);
  const [isSelected, setSelected, clearSelection, isNodeSelected] = useLexicalNodeSelection(
    node.getKey(),
  );
  const [selectedTheme, setSelectedTheme] = useState('One Dark Pro');
  const [selectedLang, setSelectedLang] = useState(node.lang || 'javascript');
  const { cx, styles } = useStyles();

  // 语言选项
  const languageOptions = MODES.map((mode) => ({
    label: mode.name,
    value: mode.value,
  }));

  // 主题选项
  const themeOptions = THEMES.map((theme) => ({
    label: theme.name,
    value: theme.value,
  }));

  // 复制代码
  const handleCopy = useCallback(async () => {
    if (instanceRef.current) {
      const code = instanceRef.current.getValue();
      try {
        await navigator.clipboard.writeText(code);
        message.success('代码已复制到剪贴板');
      } catch {
        message.error('复制失败');
      }
    }
  }, []);

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
  const handleThemeChange = useCallback((value: string) => {
    setSelectedTheme(value);
    if (instanceRef.current) {
      instanceRef.current.setOption('theme', value);
    }
    editor.update(() => {
      node.setCodeTheme(value);
    });
  }, []);

  useEffect(() => {
    const sel = editor.read(() => $getSelection());
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
          lineNumbers: true,
          mode: node.lang,
          theme: 'One Dark Pro',
          value: node.code,
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

        instance.on('blur', () => {
          setFocused(false);
        });
        instance.on('focus', () => {
          setFocused(true);
          if (
            editor.read(() => {
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
    <div
      className={cx(styles, isSelected && !isNodeSelected && 'selected', className)}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onSelect={(e) => e.stopPropagation()}
    >
      {/* 工具条 */}
      <div className="toolbar">
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: '8px',
            visibility: isFocused || isSelectFocused ? 'visible' : 'hidden',
          }}
        >
          <Select
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            onBlur={() => setSelectFocused(false)}
            onChange={handleLanguageChange}
            onFocus={() => setSelectFocused(true)}
            options={languageOptions}
            placeholder="选择语言"
            showSearch
            size="small"
            style={{ minWidth: '120px' }}
            value={selectedLang}
          />
          <Select
            onBlur={() => setSelectFocused(false)}
            onChange={handleThemeChange}
            onFocus={() => setSelectFocused(true)}
            options={themeOptions}
            placeholder="选择主题"
            size="small"
            style={{ minWidth: '120px' }}
            value={selectedTheme}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            icon={<Copy size={14} />}
            onClick={handleCopy}
            onMouseDown={(e) => e.preventDefault()}
            size="small"
            type="text"
          />
        </div>
      </div>

      {/* CodeMirror 编辑器容器 */}
      <div style={{ position: 'relative', width: '100%' }}>
        <textarea ref={ref} />
      </div>
    </div>
  );
});

ReactCodemirrorNode.displayName = 'ReactCodemirrorNode';

export default ReactCodemirrorNode;
