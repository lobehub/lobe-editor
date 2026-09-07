import { LexicalRenderer } from '@lobehub/editor/renderer';
import { Flexbox } from '@lobehub/ui';
import { ChatActionsBar, ChatList, type ChatMessage } from '@lobehub/ui/chat';
import { createStaticStyles, cx } from 'antd-style';
import type { SerializedEditorState } from 'lexical';
import { type FC, type PropsWithChildren, type ReactNode, useEffect, useRef } from 'react';

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
    flex-direction: column !important;
    background: ${cssVar.colorBgContainer};
  `,
  main: css`
    min-width: 0;
    min-height: 0;
  `,
  scrollContainer: css`
    overflow-y: auto;
  `,
  sidebar: css`
    overflow-y: auto;
    flex: none;

    width: 100%;
    max-height: 260px;
    padding: 12px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorBgElevated};
  `,
}));

interface ContainerProps {
  fullscreen?: boolean;
  messages: ChatMessage[];
  notificationPanel?: ReactNode;
}

const MentionChatContainer: FC<PropsWithChildren<ContainerProps>> = ({
  children,
  messages,
  fullscreen,
  notificationPanel,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.scrollTo(0, ref.current.scrollHeight);
  }, [messages]);

  return (
    <Flexbox className={styles.root} height={'100vh'} width={'100%'}>
      <Flexbox className={styles.main} flex={1}>
        <Flexbox className={styles.scrollContainer} flex={1} ref={ref}>
          <ChatList
            data={messages}
            renderActions={{
              default: ChatActionsBar,
            }}
            renderMessages={{
              default: ({ id, editableContent, extra }) => (
                <div id={id}>
                  {extra?.serializedDocument ? (
                    <LexicalRenderer
                      value={extra.serializedDocument as SerializedEditorState}
                      variant="chat"
                    />
                  ) : (
                    editableContent
                  )}
                </div>
              ),
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
      {notificationPanel && <Flexbox className={styles.sidebar}>{notificationPanel}</Flexbox>}
    </Flexbox>
  );
};

export default MentionChatContainer;
