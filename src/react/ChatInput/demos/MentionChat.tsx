import { GET_MENTIONS_COMMAND, type MentionDescriptor } from '@lobehub/editor';
import { ChatInput, type ChatInputProps, useEditor, useEditorState } from '@lobehub/editor/react';
import { Avatar } from '@lobehub/ui';
import type { ChatMessage } from '@lobehub/ui/chat';
import { StoryBook, useControls, useCreateStore } from '@lobehub/ui/storybook';
import { createStaticStyles, cssVar } from 'antd-style';
import { BellIcon, CheckIcon, Code2Icon, UsersIcon } from 'lucide-react';
import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import ActionToolbar from './ActionToolbar';
import {
  InMemoryMessageEventBus,
  type MentionNotification,
  MentionNotificationSubscriber,
  type MessageSentEvent,
  MessageService,
} from './mention-notifications';
import MentionChatContainer from './MentionChatContainer';
import MentionChatInputEditor from './MentionChatInputEditor';
import TypoToolbar from './TypoToolbar';

const CURRENT_USER_ID = 'me';

const CURRENT_PERSON = {
  avatar: '🙂',
  id: CURRENT_USER_ID,
  name: '我',
  role: '产品负责人',
} as const;

const PEOPLE = [
  { avatar: '🧭', id: 'alice', name: 'Alice', role: '产品设计' },
  { avatar: '🧪', id: 'bob', name: 'Bob', role: '测试工程师' },
  { avatar: '🛠️', id: 'carol', name: 'Carol', role: '前端开发' },
] as const;

const ALL_PEOPLE = [CURRENT_PERSON, ...PEOPLE];

const TEAM_MESSAGES: ChatMessage[] = [
  {
    content: '首页空状态的文案我整理好了，大家下午一起过一遍？',
    createAt: 1_686_437_950_084,
    extra: {},
    id: 'team-1',
    meta: { avatar: '🧭', title: 'Alice' },
    role: 'user',
    updateAt: 1_686_437_950_084,
  },
  {
    content: '可以，我会把交互说明和验收标准一起补到任务里。',
    createAt: 1_686_438_050_084,
    extra: {},
    id: 'team-2',
    meta: { avatar: '🙂', title: '我' },
    role: 'user',
    updateAt: 1_686_438_050_084,
  },
  {
    content: '测试环境已经准备好，等设计稿确认后我就开始回归。',
    createAt: 1_686_438_150_084,
    extra: {},
    id: 'team-3',
    meta: { avatar: '🧪', title: 'Bob' },
    role: 'assistant',
    updateAt: 1_686_438_150_084,
  },
];

const panelStyles = createStaticStyles(({ css, cssVar: token }) => ({
  badge: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    min-width: 18px;
    height: 18px;
    padding-inline: 5px;
    border-radius: 9px;

    font-size: 11px;
    font-weight: 600;
    line-height: 18px;
    color: ${token.colorTextLightSolid};

    background: ${token.colorError};
  `,
  button: css`
    cursor: pointer;

    display: flex;
    gap: 9px;
    align-items: center;

    width: 100%;
    padding: 8px;
    border: 1px solid transparent;
    border-radius: 8px;

    color: ${token.colorText};
    text-align: start;

    background: transparent;

    &:hover {
      background: ${token.colorFillQuaternary};
    }
  `,
  buttonSelected: css`
    border-color: ${token.colorPrimaryBorder};
    background: ${token.colorPrimaryBg};
  `,
  card: css`
    padding: 9px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 8px;

    color: ${token.colorText};

    background: ${token.colorBgContainer};
  `,
  inspector: css`
    margin-block-start: 10px;
    padding: 9px;
    border-radius: 8px;

    color: ${token.colorTextSecondary};

    background: ${token.colorFillQuaternary};
  `,
  muted: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  root: css`
    display: grid;
    gap: 12px;
  `,
}));

const getPerson = (id: string) =>
  ALL_PEOPLE.find((person) => person.id === id) || {
    avatar: '?',
    id,
    name: id,
    role: '未知用户',
  };

interface MentionNotificationPanelProps {
  inspectorOpen: boolean;
  lastInsertedMention: MentionDescriptor | null;
  lastMessageEvent: MessageSentEvent | null;
  notifications: MentionNotification[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onQueryMentions: () => void;
  onSelectViewer: (id: string) => void;
  queriedMentions: MentionDescriptor[] | null;
  readNotificationIds: Set<string>;
  setInspectorOpen: (open: boolean) => void;
  viewerId: string;
}

const MentionNotificationPanel: FC<MentionNotificationPanelProps> = ({
  inspectorOpen,
  lastInsertedMention,
  lastMessageEvent,
  notifications,
  onMarkAllRead,
  onMarkRead,
  onQueryMentions,
  onSelectViewer,
  queriedMentions,
  readNotificationIds,
  setInspectorOpen,
  viewerId,
}) => {
  const viewer = getPerson(viewerId);
  const viewerNotifications = notifications.filter(
    (notification) => notification.recipientId === viewerId,
  );
  const unreadCount = (id: string) =>
    notifications.filter(
      (notification) =>
        notification.recipientId === id && !readNotificationIds.has(notification.id),
    ).length;

  return (
    <div className={panelStyles.root}>
      <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
        <UsersIcon size={16} />
        <strong style={{ fontSize: 14 }}>提及通知</strong>
      </div>
      <div className={panelStyles.muted}>切换查看收件人；发送者始终是“我”。</div>
      <div style={{ display: 'grid', gap: 4 }}>
        {ALL_PEOPLE.map((person) => (
          <button
            className={`${panelStyles.button} ${person.id === viewerId ? panelStyles.buttonSelected : ''}`}
            key={person.id}
            onClick={() => person.id !== CURRENT_USER_ID && onSelectViewer(person.id)}
            type="button"
          >
            <Avatar avatar={person.avatar} size={28} />
            <span style={{ display: 'grid', flex: 1, gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{person.name}</span>
              <span className={panelStyles.muted}>{person.role}</span>
            </span>
            {unreadCount(person.id) > 0 && (
              <span className={panelStyles.badge}>{unreadCount(person.id)}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${cssVar.colorBorderSecondary}`, paddingTop: 12 }}>
        <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ alignItems: 'center', display: 'flex', gap: 7 }}>
            <BellIcon size={15} />
            <strong style={{ fontSize: 13 }}>{viewer.name} 的收件箱</strong>
          </div>
          {viewerNotifications.length > 0 && (
            <button
              onClick={onMarkAllRead}
              style={{
                background: 'transparent',
                border: 0,
                color: cssVar.colorPrimary,
                cursor: 'pointer',
                fontSize: 11,
                padding: 0,
              }}
              type="button"
            >
              全部已读
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
          {viewerNotifications.length === 0 ? (
            <div className={panelStyles.card} style={{ color: cssVar.colorTextTertiary }}>
              暂无提及通知
            </div>
          ) : (
            viewerNotifications.map((notification) => {
              const unread = !readNotificationIds.has(notification.id);
              return (
                <button
                  key={notification.id}
                  onClick={() => onMarkRead(notification.id)}
                  style={{
                    background: unread ? cssVar.colorPrimaryBg : cssVar.colorBgContainer,
                    border: `1px solid ${unread ? cssVar.colorPrimaryBorder : cssVar.colorBorderSecondary}`,
                    borderRadius: 8,
                    color: cssVar.colorText,
                    cursor: 'pointer',
                    padding: 9,
                    textAlign: 'start',
                  }}
                  type="button"
                >
                  <div style={{ alignItems: 'center', display: 'flex', gap: 6 }}>
                    {unread && <span className={panelStyles.badge}>新</span>}
                    <strong style={{ fontSize: 12 }}>收到一条提及</strong>
                    {!unread && <CheckIcon color={cssVar.colorSuccess} size={13} />}
                  </div>
                  <div className={panelStyles.muted} style={{ marginTop: 5 }}>
                    {notification.text}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${cssVar.colorBorderSecondary}`, paddingTop: 12 }}>
        <button
          onClick={() => setInspectorOpen(!inspectorOpen)}
          style={{
            alignItems: 'center',
            background: 'transparent',
            border: 0,
            color: cssVar.colorTextSecondary,
            cursor: 'pointer',
            display: 'flex',
            fontSize: 12,
            gap: 6,
            padding: 0,
          }}
          type="button"
        >
          <Code2Icon size={14} />
          开发检查器 {inspectorOpen ? '收起' : '展开'}
        </button>
        {inspectorOpen && (
          <div className={panelStyles.inspector}>
            <button
              onClick={onQueryMentions}
              style={{
                background: cssVar.colorBgContainer,
                border: `1px solid ${cssVar.colorBorderSecondary}`,
                borderRadius: 6,
                color: cssVar.colorText,
                cursor: 'pointer',
                fontSize: 11,
                padding: '5px 7px',
              }}
              type="button"
            >
              查询当前全部 mentions
            </button>
            <pre style={{ fontSize: 10, margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(
                {
                  getMentions: queriedMentions,
                  mentionInserted: lastInsertedMention,
                  messageSent: lastMessageEvent
                    ? {
                        id: lastMessageEvent.message.id,
                        mentionIds: lastMessageEvent.message.mentionIds,
                        type: lastMessageEvent.type,
                      }
                    : null,
                },
                null,
                2,
              )}
            </pre>
          </div>
        )}
      </div>
      <div className={panelStyles.muted}>本地内存演示，不会向外部发送消息或通知。</div>
    </div>
  );
};

export default () => {
  const [messages, setMessages] = useState<ChatMessage[]>(TEAM_MESSAGES);
  const [showTypobar, setShowTypobar] = useState(false);
  const [notifications, setNotifications] = useState<MentionNotification[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => new Set());
  const [viewerId, setViewerId] = useState('alice');
  const [lastInsertedMention, setLastInsertedMention] = useState<MentionDescriptor | null>(null);
  const [lastMessageEvent, setLastMessageEvent] = useState<MessageSentEvent | null>(null);
  const [queriedMentions, setQueriedMentions] = useState<MentionDescriptor[] | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const editor = useEditor();
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const editorState = useEditorState(editor);
  const store = useCreateStore();
  const services = useMemo(() => {
    const events = new InMemoryMessageEventBus();
    return {
      events,
      messages: new MessageService(events),
      notifications: new MentionNotificationSubscriber(events, {
        eligibleRecipientIds: PEOPLE.map((person) => person.id),
      }),
    };
  }, []);

  const controls = useControls(
    {
      fullscreen: false,
      maxHeight: {
        max: 480,
        min: 240,
        step: 1,
        value: 320,
      },
      minHeight: {
        max: 240,
        min: 16,
        step: 1,
        value: 32,
      },
      resize: true,
      showResizeHandle: false,
    },
    { store },
  ) as ChatInputProps;

  useEffect(() => {
    const removeEventListener = services.events.subscribe((event) => {
      setLastMessageEvent(event);
      setMessages((current) => [
        ...current,
        {
          content: event.message.text,
          createAt: Date.now(),
          extra: {
            mentionIds: event.message.mentionIds,
            serializedDocument: event.message.document,
          },
          id: event.message.id,
          meta: { avatar: '🙂', title: '我' },
          role: 'user',
          updateAt: Date.now(),
        },
      ]);
    });
    const removeNotificationListener = services.notifications.subscribe((notification) => {
      setNotifications(services.notifications.getNotifications());
      setReadNotificationIds((current) => {
        const next = new Set(current);
        next.delete(notification.id);
        return next;
      });
    });
    services.notifications.start();

    return () => {
      removeEventListener();
      removeNotificationListener();
      services.notifications.stop();
    };
  }, [services]);

  useEffect(() => {
    const listener = (mention: MentionDescriptor) => setLastInsertedMention(mention);
    editor.on('mentionInserted', listener);
    return () => {
      editor.off('mentionInserted', listener);
    };
  }, [editor]);

  const handleSendMessage = () => {
    const text = String(editor.getDocument('text') || '').trim();
    if (!text) return;

    const document = editor.getDocument('json');
    let submitted = false;
    editor.dispatchCommand(GET_MENTIONS_COMMAND, {
      onResult: (mentions) => {
        services.messages.send({
          document,
          mentions,
          senderId: CURRENT_USER_ID,
          text,
        });
        submitted = true;
      },
    });
    if (submitted) {
      editor.cleanDocument();
      editor.focus();
    }
  };

  useHotkeys('alt+enter', handleSendMessage, {
    enableOnContentEditable: true,
    preventDefault: true,
  });

  useHotkeys(
    'alt+n',
    () => {
      setMessages([]);
    },
    {
      enableOnContentEditable: true,
      preventDefault: true,
    },
  );

  const handleQueryMentions = () => {
    editor.dispatchCommand(GET_MENTIONS_COMMAND, {
      onResult: (mentions) => setQueriedMentions(mentions),
    });
  };

  const markRead = (id: string) => {
    setReadNotificationIds((current) => new Set(current).add(id));
  };

  const markAllRead = () => {
    setReadNotificationIds((current) => {
      const next = new Set(current);
      notifications
        .filter((notification) => notification.recipientId === viewerId)
        .forEach((notification) => next.add(notification.id));
      return next;
    });
  };

  return (
    <StoryBook levaStore={store} noPadding>
      <MentionChatContainer
        fullscreen={controls.fullscreen}
        messages={messages}
        notificationPanel={
          <MentionNotificationPanel
            inspectorOpen={inspectorOpen}
            lastInsertedMention={lastInsertedMention}
            lastMessageEvent={lastMessageEvent}
            notifications={notifications}
            onMarkAllRead={markAllRead}
            onMarkRead={markRead}
            onQueryMentions={handleQueryMentions}
            onSelectViewer={setViewerId}
            queriedMentions={queriedMentions}
            readNotificationIds={readNotificationIds}
            setInspectorOpen={setInspectorOpen}
            viewerId={viewerId}
          />
        }
      >
        <ChatInput
          defaultHeight={64}
          footer={
            <ActionToolbar
              onSend={handleSendMessage}
              sendDisabled={editorState.isEmpty}
              setShowTypobar={setShowTypobar}
              showTypobar={showTypobar}
            />
          }
          header={<TypoToolbar editor={editor} show={showTypobar} />}
          onSizeChange={() => {}}
          slashMenuRef={slashMenuRef}
          {...controls}
        >
          <MentionChatInputEditor
            editor={editor}
            onSend={handleSendMessage}
            slashMenuRef={slashMenuRef}
          />
        </ChatInput>
      </MentionChatContainer>
    </StoryBook>
  );
};
