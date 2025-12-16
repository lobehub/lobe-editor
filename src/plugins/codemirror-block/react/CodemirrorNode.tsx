'use client';

import { mergeRegister } from '@lexical/utils';
import { ActionIcon, Block, InputNumber, Select } from '@lobehub/ui';
import { Popover, Space, Switch, message } from 'antd';
import { $getSelection, COMMAND_PRIORITY_CRITICAL, KEY_DOWN_COMMAND, LexicalEditor } from 'lexical';
import { debounce } from 'lodash';
import { Copy, Settings } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Flexbox } from 'react-layout-kit';

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
  // use any to avoid strict typing on optional persistence fields
  const [tabSize, setTabSize] = useState<number>(node.options.tabSize ?? 2);
  const [useTabs, setUseTabs] = useState<boolean>(node.options.indentWithTabs ?? false);
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(node.options.lineNumbers ?? true);
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
          // keep options alphabetically ordered
          indentWithTabs: useTabs,
          lineNumbers: true,
          mode: node.lang,
          tabSize,
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
    <Block
      className={cx(styles, isSelected && !isNodeSelected && 'selected', className)}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onSelect={(e) => e.stopPropagation()}
      variant={'filled'}
    >
      {/* 工具条 */}
      <Flexbox align={'center'} horizontal justify={'space-between'} padding={8}>
        <Flexbox
          align={'center'}
          gap={8}
          horizontal
          style={{
            visibility: isFocused || isSelectFocused ? 'visible' : 'hidden',
          }}
        >
          <Select
            filterOption={(input, option) =>
              String(option?.label ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
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
        </Flexbox>
        <Flexbox gap={8} horizontal>
          <ActionIcon
            icon={Copy}
            onClick={handleCopy}
            onMouseDown={(e) => e.preventDefault()}
            size="small"
          />
          <Popover
            arrow={false}
            content={
              <Space direction="vertical">
                <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                  <span>Tab Size</span>
                  <InputNumber
                    max={8}
                    min={1}
                    onChange={handleTabSizeChange as any}
                    size="small"
                    value={tabSize}
                  />
                </div>
                <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                  <span>Use Tabs</span>
                  <Switch checked={useTabs} onChange={handleUseTabsChange} size="small" />
                </div>
                <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                  <span>Show Line Numbers</span>
                  <Switch
                    checked={showLineNumbers}
                    onChange={handleShowLineNumbersChange}
                    size="small"
                  />
                </div>
              </Space>
            }
            placement="bottomRight"
            trigger="click"
          >
            <ActionIcon icon={Settings} onMouseDown={(e) => e.preventDefault()} size="small" />
          </Popover>
        </Flexbox>
      </Flexbox>

      {/* CodeMirror 编辑器容器 */}
      <div style={{ position: 'relative', width: '100%' }}>
        <textarea ref={ref} />
      </div>
    </Block>
  );
});

ReactCodemirrorNode.displayName = 'ReactCodemirrorNode';

export default ReactCodemirrorNode;
