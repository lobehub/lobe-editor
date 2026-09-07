/**
 * The notification demo keeps the editor and message delivery concerns separate:
 * the editor supplies a final serialized document and mention descriptors,
 * while this module owns the message.sent event and its in-memory notification
 * subscriber.
 */

import type { MentionDescriptor } from '@/plugins/mention/type';

export const MESSAGE_SENT_EVENT = 'message.sent' as const;

export interface MessageSentEvent {
  type: typeof MESSAGE_SENT_EVENT;
  message: {
    document: unknown;
    id: string;
    mentionIds: string[];
    mentions: MentionDescriptor[];
    senderId: string;
    text: string;
  };
}

export interface MentionNotification {
  id: string;
  messageId: string;
  recipientId: string;
  senderId: string;
  text: string;
}

export interface SendMessageInput {
  document: unknown;
  messageId?: string;
  mentions: MentionDescriptor[];
  senderId: string;
  text: string;
}

export type MessageSentListener = (event: MessageSentEvent) => void;

export interface MessageEventBus {
  publish(event: MessageSentEvent): void;
  subscribe(listener: MessageSentListener): () => void;
}

/** The business layer deduplicates IDs after the editor query returns all mentions. */
export function collectMentionIds(mentions: readonly MentionDescriptor[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  mentions.forEach((mention) => {
    const id = mention.metadata.id;
    if (typeof id === 'string' && id.length > 0 && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  });
  return ids;
}

export class InMemoryMessageEventBus implements MessageEventBus {
  private readonly listeners = new Set<MessageSentListener>();

  publish(event: MessageSentEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  subscribe(listener: MessageSentListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export function createMessageSentEvent(
  input: SendMessageInput,
  messageId: string,
): MessageSentEvent {
  return {
    type: MESSAGE_SENT_EVENT,
    message: {
      document: input.document,
      id: messageId,
      mentionIds: collectMentionIds(input.mentions),
      mentions: input.mentions.map((mention) => ({
        label: mention.label,
        metadata: { ...mention.metadata },
      })),
      senderId: input.senderId,
      text: input.text,
    },
  };
}

/** The message service is the only demo entry point that emits message.sent. */
export class MessageService {
  private nextMessageId = 1;

  constructor(private readonly eventBus: MessageEventBus) {}

  send(input: SendMessageInput): MessageSentEvent {
    const messageId = input.messageId || `message-${this.nextMessageId++}`;
    const event = createMessageSentEvent(input, messageId);
    this.eventBus.publish(event);
    return event;
  }
}

export interface MentionNotificationSubscriberOptions {
  eligibleRecipientIds: Iterable<string>;
}

/** Subscribes to sent messages and creates one notification per eligible user. */
export class MentionNotificationSubscriber {
  private readonly eligibleRecipientIds: ReadonlySet<string>;
  private readonly listeners = new Set<(notification: MentionNotification) => void>();
  private readonly notifications: MentionNotification[] = [];
  private nextNotificationId = 1;
  private readonly eventBus: MessageEventBus;
  private unsubscribeFromEvents: (() => void) | null = null;

  constructor(eventBus: MessageEventBus, options: MentionNotificationSubscriberOptions) {
    this.eventBus = eventBus;
    this.eligibleRecipientIds = new Set(options.eligibleRecipientIds);
    this.start();
  }

  start(): void {
    if (this.unsubscribeFromEvents) return;
    this.unsubscribeFromEvents = this.eventBus.subscribe((event) => this.handleMessageSent(event));
  }

  stop(): void {
    this.unsubscribeFromEvents?.();
    this.unsubscribeFromEvents = null;
  }

  dispose(): void {
    this.stop();
    this.listeners.clear();
  }

  getNotifications(): MentionNotification[] {
    return [...this.notifications];
  }

  subscribe(listener: (notification: MentionNotification) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private handleMessageSent(event: MessageSentEvent): void {
    event.message.mentionIds.forEach((recipientId) => {
      if (recipientId === event.message.senderId || !this.eligibleRecipientIds.has(recipientId)) {
        return;
      }

      const notification: MentionNotification = {
        id: `notification-${this.nextNotificationId++}`,
        messageId: event.message.id,
        recipientId,
        senderId: event.message.senderId,
        text: event.message.text,
      };
      this.notifications.push(notification);
      this.listeners.forEach((listener) => listener(notification));
    });
  }
}
