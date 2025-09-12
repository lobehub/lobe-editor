import {
  IEditor,
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_MENTION_COMMAND,
  INSERT_TABLE_COMMAND,
  ReactCodePlugin,
  ReactCodeblockPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactMathPlugin,
  ReactTablePlugin,
  type SlashOptions,
} from '@lobehub/editor';
import { Editor, FloatMenu, SlashMenu } from '@lobehub/editor/react';
import { Avatar, Text } from '@lobehub/ui';
import { Heading1Icon, Heading2Icon, Heading3Icon, MinusIcon, Table2Icon } from 'lucide-react';
import { Ref, memo, useMemo } from 'react';

import { content } from './data';

const InputEditor = memo<{
  editor: IEditor;
  fullscreen?: boolean;
  onSend?: () => void;
  slashMenuRef: Ref<HTMLDivElement>;
}>(({ editor, slashMenuRef, onSend, fullscreen }) => {
  const mentionItems: SlashOptions['items'] = useMemo(
    () => [
      {
        icon: <Avatar avatar={'💻'} size={24} />,
        key: 'bot1',
        label: '前端研发专家',
        metadata: { id: 'bot1' },
      },
      {
        icon: <Avatar avatar={'🌍'} size={24} />,
        key: 'bot2',
        label: '中英文互译助手',
        metadata: { id: 'bot2' },
      },
      {
        icon: <Avatar avatar={'📖'} size={24} />,
        key: 'bot3',
        label: '学术写作增强专家',
        metadata: { id: 'bot3' },
      },
    ],
    [],
  );

  const slashItems: SlashOptions['items'] = useMemo(() => {
    const data: SlashOptions['items'] = [
      {
        icon: Heading1Icon,
        key: 'h1',
        label: 'Heading 1',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h1' });
        },
      },
      {
        icon: Heading2Icon,
        key: 'h2',
        label: 'Heading 2',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h2' });
        },
      },
      {
        icon: Heading3Icon,
        key: 'h3',
        label: 'Heading 3',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h3' });
        },
      },

      {
        type: 'divider',
      },
      {
        icon: MinusIcon,
        key: 'hr',
        label: 'Hr',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, {});
        },
      },
      {
        icon: Table2Icon,
        key: 'table',
        label: 'Table',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', rows: '3' });
        },
      },
    ];
    return data.map((item) => {
      if (item.type === 'divider') return item;
      return {
        ...item,
        extra: (
          <Text code fontSize={12} type={'secondary'}>
            {item.key}
          </Text>
        ),
      };
    });
  }, []);

  return (
    <Editor
      autoFocus
      content={content}
      editor={editor}
      mentionOption={{
        items: mentionItems,
        markdownWriter: (mention) => {
          return `\n<mention>${mention.label}[${mention.metadata?.id || mention.label}]</mention>\n`;
        },
        onSelect: (editor, option) => {
          editor.dispatchCommand(INSERT_MENTION_COMMAND, {
            label: String(option.label),
            metadata: { id: option.key },
          });
        },
        renderComp: fullscreen
          ? undefined
          : (props) => {
              if (props.options.length === 0) return;
              return (
                <SlashMenu {...props} getPopupContainer={() => (slashMenuRef as any).current} />
              );
            },
        searchKeys: ['label'],
      }}
      onBlur={({ editor, event }) => console.log('Blur', editor, event)}
      onCompositionEnd={({ editor, event }) => console.log('Composition End', editor, event)}
      onCompositionStart={({ editor, event }) => console.log('Composition Start', editor, event)}
      onFocus={({ editor, event }) => console.log('Focus', editor, event)}
      onPressEnter={({ event }) => {
        console.log('Enter pressed', { ctrlKey: event.ctrlKey, metaKey: event.metaKey });

        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          console.log('[Enter pressed] allowing new line');
          return;
        }

        console.log('[Enter pressed] sending message');
        onSend?.();
        return true;
      }}
      placeholder={'Type something...'}
      plugins={[
        ReactListPlugin,
        ReactLinkPlugin,
        ReactImagePlugin,
        ReactCodeblockPlugin,
        ReactHRPlugin,
        ReactCodePlugin,
        ReactTablePlugin,
        Editor.withProps(ReactMathPlugin, {
          renderComp: fullscreen
            ? undefined
            : (props) => (
                <FloatMenu {...props} getPopupContainer={() => (slashMenuRef as any).current} />
              ),
        }),
      ]}
      slashOption={{
        items: slashItems,
        maxLength: 6,
        renderComp: fullscreen
          ? undefined
          : (props) => {
              return (
                <SlashMenu {...props} getPopupContainer={() => (slashMenuRef as any).current} />
              );
            },
      }}
      variant={'chat'}
    />
  );
});

export default InputEditor;
