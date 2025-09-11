import { ChatActionsBar, ChatList, type ChatMessage } from '@lobehub/ui/chat';
import { useTheme } from 'antd-style';
import { type PropsWithChildren, memo, useEffect, useRef } from 'react';
import { Flexbox } from 'react-layout-kit';

const Container = memo<PropsWithChildren<{ messages: ChatMessage[] }>>(({ children, messages }) => {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.scrollTo(0, ref.current.scrollHeight);
  }, [messages]);

  return (
    <Flexbox
      height={'100vh'}
      style={{
        background: theme.colorBgContainerSecondary,

        overflow: 'hidden',
        position: 'relative',
      }}
      width={'100%'}
    >
      <Flexbox
        flex={1}
        ref={ref}
        style={{
          overflowY: 'auto',
        }}
      >
        <ChatList
          data={messages}
          renderActions={{
            default: ChatActionsBar,
          }}
          renderMessages={{
            default: ({ id, editableContent }) => <div id={id}>{editableContent}</div>,
          }}
          style={{ width: '100%' }}
        />
      </Flexbox>
      <Flexbox paddingBlock={'0 8px'} paddingInline={8}>
        {children}
      </Flexbox>
    </Flexbox>
  );
});

export default Container;
