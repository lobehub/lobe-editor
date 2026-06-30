import type { IEditor, ISlashMenuOption, SlashOptions } from '@lobehub/editor';
import {
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_MENTION_COMMAND,
  INSERT_TABLE_COMMAND,
} from '@lobehub/editor';
import { ChatInput, Editor, useEditor, useEditorState } from '@lobehub/editor/react';
import { Avatar, Text } from '@lobehub/ui';
import {
  BrainCircuitIcon,
  FileTextIcon,
  GoalIcon,
  Heading1Icon,
  MinusIcon,
  PaperclipIcon,
  Table2Icon,
  WrenchIcon,
} from 'lucide-react';
import { useMemo, useRef } from 'react';

import ActionToolbar from './ActionToolbar';
import Container from './Container';
import { chatMessages, content } from './data';

const writeMentionMarkdown = (mention: { label: unknown; metadata?: Record<string, unknown> }) =>
  `\n<mention>${String(mention.label)}[${String(mention.metadata?.id ?? mention.label)}]</mention>\n`;

const insertMention = (editor: IEditor, option: ISlashMenuOption) => {
  editor.dispatchCommand(INSERT_MENTION_COMMAND, {
    label: String(option.label ?? option.key),
    metadata: { id: String(option.key ?? option.label) },
  });
};

export default () => {
  const editor = useEditor();
  const editorState = useEditorState(editor);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  const mentionItems: SlashOptions['items'] = useMemo(
    () => [
      {
        items: [
          {
            icon: <Avatar avatar={'💻'} size={24} />,
            key: 'agent-frontend',
            label: '前端研发专家',
            metadata: {
              description: 'Review React, TypeScript, and UI implementation details',
              id: 'agent-frontend',
            },
          },
          {
            icon: <Avatar avatar={'📖'} size={24} />,
            key: 'agent-writing',
            label: '学术写作增强专家',
            metadata: {
              description: 'Improve academic structure, tone, and references',
              id: 'agent-writing',
            },
          },
        ],
        key: 'mention-section-agents',
        label: 'Agents',
        type: 'section',
      },
      {
        items: [
          {
            icon: WrenchIcon,
            key: 'tool-browser',
            label: '浏览器',
            metadata: {
              description: 'Control the in-app browser with Codex',
              id: 'tool-browser',
            },
          },
          {
            icon: FileTextIcon,
            key: 'tool-pdf',
            label: 'PDF',
            metadata: {
              description: 'Read, create, and verify PDF files',
              id: 'tool-pdf',
            },
          },
        ],
        key: 'mention-section-tools',
        label: 'Tools',
        type: 'section',
      },
    ],
    [],
  );

  const slashItems: SlashOptions['items'] = useMemo(
    () => [
      {
        items: [
          {
            icon: PaperclipIcon,
            key: 'files',
            label: 'Files and folders',
            metadata: { description: 'Attach local files or folders to the conversation' },
          },
          {
            icon: GoalIcon,
            key: 'goal',
            label: 'Goal',
            metadata: { description: 'Set a persistent objective for Codex to pursue' },
          },
          {
            icon: BrainCircuitIcon,
            key: 'reasoning',
            label: 'Reasoning',
            metadata: { description: 'Use high-effort reasoning for complex work' },
          },
        ],
        key: 'slash-section-add',
        label: 'Add',
        type: 'section',
      },
      {
        items: [
          {
            icon: Heading1Icon,
            key: 'heading',
            label: 'Heading',
            metadata: { description: 'Insert a heading block' },
            onSelect: (editor) => {
              editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h1' });
            },
          },
          {
            icon: Table2Icon,
            key: 'table',
            label: 'Table',
            metadata: { description: 'Insert a 3 by 3 table' },
            onSelect: (editor) => {
              editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', rows: '3' });
            },
          },
          {
            extra: (
              <Text code fontSize={12} type={'secondary'}>
                hr
              </Text>
            ),
            icon: MinusIcon,
            key: 'hr',
            label: 'Horizontal rule',
            metadata: { description: 'Insert a visual divider' },
            onSelect: (editor) => {
              editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, {});
            },
          },
        ],
        key: 'slash-section-format',
        label: 'Format',
        type: 'section',
      },
    ],
    [],
  );

  const handleSend = () => {
    editor?.cleanDocument();
    editor?.focus();
  };

  return (
    <Container messages={chatMessages}>
      <ChatInput
        defaultHeight={96}
        footer={
          <ActionToolbar
            onSend={handleSend}
            sendDisabled={!editor || editorState.isEmpty}
            setShowTypobar={() => {}}
          />
        }
        maxHeight={320}
        minHeight={64}
        slashMenuRef={slashMenuRef}
      >
        <Editor
          autoFocus
          content={content}
          editor={editor}
          getPopupContainer={() => slashMenuRef.current}
          mentionOption={{
            items: mentionItems,
            markdownWriter: writeMentionMarkdown,
            onSelect: insertMention,
            searchKeys: ['label', 'metadata.description'],
          }}
          placeholder={'Type @ or / to open sectioned menus'}
          slashOption={{
            fuseOptions: {
              keys: ['label', 'metadata.description'],
            },
            items: slashItems,
          }}
          variant={'chat'}
        />
      </ChatInput>
    </Container>
  );
};
