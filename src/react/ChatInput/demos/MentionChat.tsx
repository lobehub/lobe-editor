import {
  IMentionService,
  INSERT_MENTION_COMMAND,
  type MentionDescriptor,
  ReactCodemirrorPlugin,
  ReactCodePlugin,
  ReactCollapsiblePlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkHighlightPlugin,
  ReactListPlugin,
  ReactMathPlugin,
  ReactTablePlugin,
  type SlashOptions,
} from '@lobehub/editor';
import {
  ChatInput,
  type ChatInputProps,
  Editor,
  useEditor,
  useEditorState,
} from '@lobehub/editor/react';
import { Avatar } from '@lobehub/ui';
import type { ChatMessage } from '@lobehub/ui/chat';
import { StoryBook, useControls, useCreateStore } from '@lobehub/ui/storybook';
import { createStaticStyles } from 'antd-style';
import { BellIcon, SearchIcon } from 'lucide-react';
import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import ActionToolbar from './ActionToolbar';
import Container from './Container';
import { content } from './data';
import TypoToolbar from './TypoToolbar';

const CURRENT_USER_ID = 'me';

const PEOPLE = [
  { avatar: '🧭', id: 'alice', name: 'Alice', role: '产品设计' },
  { avatar: '🧪', id: 'bob', name: 'Bob', role: '测试工程师' },
  { avatar: '🛠️', id: 'carol', name: 'Carol', role: '前端开发' },
] as const;

const peopleIds = new Set<string>(PEOPLE.map((person) => person.id));

const initialMessages: ChatMessage[] = [
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
];

const styles = createStaticStyles(({ css, cssVar: token }) => ({
  code: css`
    overflow: auto;

    max-height: 120px;
    margin-block: 8px 0;
    margin-inline: 0;
    padding: 8px;
    border-radius: 6px;

    font-size: 11px;
    white-space: pre-wrap;

    background: ${token.colorFillQuaternary};
  `,
  inspector: css`
    display: grid;
    gap: 8px;

    padding: 10px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 8px;

    color: ${token.colorText};

    background: ${token.colorBgContainer};
  `,
  muted: css`
    font-size: 12px;
    color: ${token.colorTextSecondary};
  `,
  root: css`
    display: grid;
    gap: 10px;
  `,
}));

interface MentionNotification {
  content: string;
  id: string;
  recipientId: string;
}

interface MentionInspectorProps {
  lastInserted: MentionDescriptor | null;
  notifications: MentionNotification[];
  onQuery: () => void;
  queriedMentions: MentionDescriptor[] | null;
}

const MentionInspector: FC<MentionInspectorProps> = ({
  lastInserted,
  notifications,
  onQuery,
  queriedMentions,
}) => (
  <div className={styles.inspector}>
    <div style={{ alignItems: 'center', display: 'flex', gap: 6 }}>
      <BellIcon size={15} />
      <strong>提及通知与服务查询</strong>
    </div>
    <div className={styles.muted}>
      输入 <code>@</code> 选择成员；发送时业务层会读取 mentions，去重并生成模拟通知。
    </div>
    <button onClick={onQuery} type="button">
      <SearchIcon size={13} /> 查询当前 mentions
    </button>
    <div className={styles.muted}>
      最近插入：
      {lastInserted
        ? `${lastInserted.label} (${String(lastInserted.metadata.id ?? '无 ID')})`
        : '暂无'}
    </div>
    {queriedMentions && (
      <pre className={styles.code}>{JSON.stringify(queriedMentions, null, 2)}</pre>
    )}
    <div className={styles.muted}>
      {PEOPLE.map((person) => {
        const count = notifications.filter((item) => item.recipientId === person.id).length;
        return (
          <span key={person.id} style={{ marginInlineEnd: 10 }}>
            <Avatar avatar={person.avatar} size={18} /> {person.name}: {count} 条
          </span>
        );
      })}
    </div>
  </div>
);

function collectRecipientIds(mentions: readonly MentionDescriptor[]): string[] {
  const ids = new Set<string>();

  for (const mention of mentions) {
    const id = mention.metadata.id;
    if (typeof id === 'string' && id !== CURRENT_USER_ID && peopleIds.has(id)) {
      ids.add(id);
    }
  }

  return [...ids];
}

export default () => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [notifications, setNotifications] = useState<MentionNotification[]>([]);
  const [lastInserted, setLastInserted] = useState<MentionDescriptor | null>(null);
  const [queriedMentions, setQueriedMentions] = useState<MentionDescriptor[] | null>(null);
  const [showTypobar, setShowTypobar] = useState(false);
  const editor = useEditor();
  const editorState = useEditorState(editor);
  const mentionServiceRef = useRef<IMentionService | null>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const store = useCreateStore();

  const controls = useControls(
    {
      fullscreen: false,
      maxHeight: { max: 480, min: 240, step: 1, value: 320 },
      minHeight: { max: 240, min: 16, step: 1, value: 32 },
      resize: true,
      showResizeHandle: false,
    },
    { store },
  ) as ChatInputProps;

  const mentionItems: SlashOptions['items'] = useMemo(
    () =>
      PEOPLE.map((person) => ({
        icon: <Avatar avatar={person.avatar} size={24} />,
        key: person.id,
        label: person.name,
        metadata: { id: person.id },
      })),
    [],
  );

  useEffect(() => {
    let attachedService: IMentionService | null = null;
    let unsubscribe: (() => void) | undefined;

    const attachService = () => {
      const nextService = editor.requireService(IMentionService);
      if (!nextService || nextService === attachedService) return;

      unsubscribe?.();
      attachedService = nextService;
      mentionServiceRef.current = nextService;
      unsubscribe = nextService.subscribe((mention) => {
        setLastInserted(mention);
      });
    };

    attachService();
    editor.on('initialized', attachService);

    return () => {
      editor.off('initialized', attachService);
      unsubscribe?.();
      mentionServiceRef.current = null;
    };
  }, [editor]);

  const handleQuery = () => {
    setQueriedMentions(mentionServiceRef.current?.getMentions() ?? []);
  };

  const handleSendMessage = () => {
    const message = editor.getDocument('markdown') as unknown as string;
    if (!message.trim()) return;

    const mentions = mentionServiceRef.current?.getMentions() ?? [];
    const recipientIds = collectRecipientIds(mentions);
    const createdAt = Date.now();

    setMessages((current) => [
      ...current,
      {
        content: message,
        createAt: createdAt,
        extra: {},
        id: String(createdAt),
        meta: { avatar: '🙂', title: '我' },
        role: 'user',
        updateAt: createdAt,
      },
    ]);
    setNotifications((current) => [
      ...current,
      ...recipientIds.map((recipientId) => ({
        content: message,
        id: `${createdAt}-${recipientId}`,
        recipientId,
      })),
    ]);
    setQueriedMentions(mentions);
    editor.setDocument('text', '');
    editor.focus();
  };

  useHotkeys('alt+enter', handleSendMessage, {
    enableOnContentEditable: true,
    preventDefault: true,
  });

  useHotkeys('alt+n', () => setMessages([]), {
    enableOnContentEditable: true,
    preventDefault: true,
  });

  return (
    <StoryBook levaStore={store} noPadding>
      <Container fullscreen={controls.fullscreen} messages={messages}>
        <div className={styles.root}>
          <MentionInspector
            lastInserted={lastInserted}
            notifications={notifications}
            onQuery={handleQuery}
            queriedMentions={queriedMentions}
          />
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
            onSizeChange={(height) => console.log('resize:', height)}
            slashMenuRef={slashMenuRef}
            {...controls}
          >
            <Editor
              autoFocus
              content={content}
              editor={editor}
              getPopupContainer={() => slashMenuRef.current}
              mentionOption={{
                items: mentionItems,
                markdownWriter: (mention) => `@${mention.label}`,
                onSelect: (nextEditor, option) => {
                  nextEditor.dispatchCommand(INSERT_MENTION_COMMAND, {
                    label: String(option.label),
                    metadata: { id: option.key },
                  });
                },
                searchKeys: ['label'],
              }}
              onPressEnter={({ event }) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                handleSendMessage();
                return true;
              }}
              placeholder="Type @ to mention someone"
              plugins={[
                ReactListPlugin,
                ReactLinkHighlightPlugin,
                ReactImagePlugin,
                ReactCodemirrorPlugin,
                ReactCollapsiblePlugin,
                ReactHRPlugin,
                ReactCodePlugin,
                ReactTablePlugin,
                ReactMathPlugin,
              ]}
              variant="chat"
            />
          </ChatInput>
        </div>
      </Container>
    </StoryBook>
  );
};
