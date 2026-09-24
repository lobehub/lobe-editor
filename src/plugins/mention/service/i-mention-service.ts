import { cloneDeep } from 'es-toolkit';
import type { ElementNode, LexicalEditor, LexicalNode } from 'lexical';
import { $getNodeByKey, $getRoot, $isElementNode, $onUpdate } from 'lexical';

import { genServiceId } from '@/editor-kernel';
import type { IServiceID } from '@/types';

import { $isMentionNode, type MentionNode } from '../node/MentionNode';
import type { MentionDescriptor } from '../type';

export type MentionInsertedListener = (mention: MentionDescriptor) => void;

export interface IMentionService {
  /** Read mentions from the latest committed editor state without flushing a pending update. */
  getMentions(): MentionDescriptor[];
  subscribe(listener: MentionInsertedListener): () => void;
}

export const IMentionService: IServiceID<IMentionService> =
  genServiceId<IMentionService>('MentionService');

/**
 * Editor-scoped mention state and insertion notifications.
 *
 * The plugin calls `onMentionInserted` while a Lexical update is active. The
 * callback is deferred with `$onUpdate`, so consumers observe the committed
 * editor state when they call `getMentions()` or `getDocument()`.
 */
export class MentionService implements IMentionService {
  private disposed = false;
  private editor: LexicalEditor | null = null;
  private readonly listeners = new Set<MentionInsertedListener>();

  bindEditor(editor: LexicalEditor): void {
    this.editor = editor;
    this.disposed = false;
  }

  /** Read the latest committed state; this method never flushes a pending update. */
  getMentions(): MentionDescriptor[] {
    const editor = this.editor;
    if (!editor || this.disposed) return [];

    return editor.getEditorState().read(() => collectMentions($getRoot()));
  }

  /** Called by MentionPlugin after an INSERT_MENTION_COMMAND has inserted a node. */
  onMentionInserted(node: MentionNode): void {
    if (this.disposed || !this.editor) return;

    const nodeKey = node.getKey();
    $onUpdate(() => this.emitInsertedMention(nodeKey));
  }

  subscribe(listener: MentionInsertedListener): () => void {
    if (this.disposed) return () => {};

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.disposed = true;
    this.editor = null;
    this.listeners.clear();
  }

  private emitInsertedMention(nodeKey: string): void {
    const editor = this.editor;
    if (this.disposed || !editor) return;

    const mention = editor.getEditorState().read(() => {
      const node = $getNodeByKey(nodeKey);
      return node && $isMentionNode(node) && node.isAttached() ? toMentionDescriptor(node) : null;
    });
    if (!mention) return;

    // Keep application callbacks outside Lexical's read-only context. A
    // callback may synchronously issue another editor update or query data.
    for (const listener of Array.from(this.listeners)) {
      if (this.disposed) return;
      if (this.listeners.has(listener)) listener(mention);
    }
  }
}

function collectMentions(
  node: LexicalNode,
  mentions: MentionDescriptor[] = [],
): MentionDescriptor[] {
  if ($isMentionNode(node)) {
    mentions.push(toMentionDescriptor(node));
  }

  if ($isElementNode(node)) {
    for (const child of (node as ElementNode).getChildren()) {
      collectMentions(child, mentions);
    }
  }

  return mentions;
}

function toMentionDescriptor(node: MentionNode): MentionDescriptor {
  const latest = node.getLatest();

  return {
    label: latest.label,
    metadata: cloneDeep(latest.metadata),
  };
}
