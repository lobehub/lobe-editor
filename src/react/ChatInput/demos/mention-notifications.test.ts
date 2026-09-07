import { describe, expect, it } from 'vitest';

import type { MentionDescriptor } from '@/plugins/mention/type';

import {
  collectMentionIds,
  InMemoryMessageEventBus,
  MentionNotificationSubscriber,
  MessageService,
} from './mention-notifications';

const emptyDocument = { root: { children: [] } };

const mentionsWithIds = (...ids: Array<string | undefined>): MentionDescriptor[] =>
  ids.map((id) => ({
    label: id ? `Label for ${id}` : 'label that must not be parsed',
    metadata: id ? { id } : {},
  }));

describe('mention notification demo business flow', () => {
  it('deduplicates metadata IDs returned by the editor query', () => {
    expect(collectMentionIds(mentionsWithIds('alice', 'bob', 'alice', undefined))).toEqual([
      'alice',
      'bob',
    ]);
  });

  it('does not use mention labels and ignores removed mentions', () => {
    const sentMentions = mentionsWithIds('alice');

    expect(collectMentionIds(sentMentions)).toEqual(['alice']);
    expect(collectMentionIds([])).toEqual([]);
  });

  it('delivers one notification per eligible recipient and skips unknown/self IDs', () => {
    const events = new InMemoryMessageEventBus();
    const notifications = new MentionNotificationSubscriber(events, {
      eligibleRecipientIds: ['alice', 'bob'],
    });
    const messages = new MessageService(events);

    messages.send({
      document: emptyDocument,
      messageId: 'message-1',
      mentions: mentionsWithIds('alice', 'alice', 'me', 'unknown'),
      senderId: 'me',
      text: 'Please review this',
    });

    expect(notifications.getNotifications()).toEqual([
      {
        id: 'notification-1',
        messageId: 'message-1',
        recipientId: 'alice',
        senderId: 'me',
        text: 'Please review this',
      },
    ]);
    notifications.dispose();
  });

  it('only creates notifications after explicit message submission', () => {
    const events = new InMemoryMessageEventBus();
    const notifications = new MentionNotificationSubscriber(events, {
      eligibleRecipientIds: ['alice'],
    });
    const messages = new MessageService(events);
    const document = emptyDocument;

    expect(notifications.getNotifications()).toEqual([]);

    messages.send({
      document,
      mentions: mentionsWithIds('alice'),
      senderId: 'me',
      text: 'Submitted once',
    });

    expect(notifications.getNotifications()).toHaveLength(1);
    notifications.dispose();
  });
});
