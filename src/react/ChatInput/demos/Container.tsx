import { Flexbox } from '@lobehub/ui';
import { ChatActionsBar, ChatList, type ChatMessage } from '@lobehub/ui/chat';
import { createStaticStyles, cx } from 'antd-style';
import { type FC, type PropsWithChildren, useEffect, useRef } from 'react';

const styles = createStaticStyles(({ css, cssVar }) => ({
  fullscreenContainer: css`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  `,
  root: css`
    position: relative;
    overflow: hidden;
    background: ${cssVar.colorBgContainer};
  `,
  scrollContainer: css`
    overflow-y: auto;
  `,
}));

interface ContainerProps {
  fullscreen?: boolean;
  messages: ChatMessage[];
}

const Container: FC<PropsWithChildren<ContainerProps>> = ({ children, messages, fullscreen }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.scrollTo(0, ref.current.scrollHeight);
  }, [messages]);

  return (
    <Flexbox className={styles.root} height={'100vh'} width={'100%'}>
      <Flexbox className={styles.scrollContainer} flex={1} ref={ref}>
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
      <Flexbox
        className={cx(fullscreen && styles.fullscreenContainer)}
        paddingBlock={fullscreen ? 8 : '0 8px'}
        paddingInline={8}
      >
        {children}
      </Flexbox>
    </Flexbox>
  );
};

export default Container;
