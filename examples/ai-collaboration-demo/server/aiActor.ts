import { CodeHighlightNode, CodeNode } from '@lexical/code-core';
import { createHeadlessEditor } from '@lexical/headless';
import { ListItemNode, ListNode } from '@lexical/list';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import type { Provider, ProviderAwareness, UserState } from '@lexical/yjs';
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $isTextNode,
  $setSelection,
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type SerializedLexicalNode,
  type TextNode,
} from 'lexical';
import {
  Doc,
  RelativePosition,
  XmlElement,
  XmlText,
  applyUpdate,
  createRelativePositionFromTypeIndex,
  encodeStateAsUpdate,
  encodeStateVector,
  relativePositionToJSON,
} from 'yjs';

import { registerCollaborationBinding } from '@/plugins/collaboration/utils';
import { HorizontalRuleNode } from '@/plugins/hr/node/HorizontalRuleNode';
import { AutoLinkNode, LinkNode } from '@/plugins/link/node/LinkNode';

import {
  AI_COLLABORATION_SYSTEM_PROMPT,
  type AiToolCall,
  aiToolDefinitions,
  runAnthropicModel,
} from './aiTools';
import { bytesToBase64 } from './codec';
import {
  type SerializedRelativePosition,
  type SerializedUserState,
  applyAwarenessUpdate,
  applyDocumentUpdate,
  clearAssistantAwareness,
  getSnapshotUpdate,
} from './rooms';

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const createTaskId = () =>
  `ai-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const STREAM_CHUNK_DELAY_MS = 35;
const SELECTED_RANGE_HANDOFF_DWELL_MS = 1000;

class HeadlessImageNode extends DecoratorNode<null> {
  static clone(node: HeadlessImageNode): HeadlessImageNode {
    return new HeadlessImageNode(node.__key);
  }

  static getType(): string {
    return 'image';
  }

  static importJSON(): HeadlessImageNode {
    return new HeadlessImageNode();
  }

  createDOM(config: EditorConfig): HTMLElement {
    void config;
    return document.createElement('span');
  }

  decorate(): null {
    return null;
  }

  exportJSON(): SerializedLexicalNode {
    return super.exportJSON();
  }

  isInline(): boolean {
    return true;
  }

  updateDOM(): false {
    return false;
  }
}

class HeadlessBlockImageNode extends HeadlessImageNode {
  static clone(node: HeadlessBlockImageNode): HeadlessBlockImageNode {
    return new HeadlessBlockImageNode(node.__key);
  }

  static getType(): string {
    return 'block-image';
  }

  static importJSON(): HeadlessBlockImageNode {
    return new HeadlessBlockImageNode();
  }

  isInline(): boolean {
    return false;
  }
}

const HEADLESS_COLLABORATION_NODES = [
  AutoLinkNode,
  CodeHighlightNode,
  CodeNode,
  HeadingNode,
  HeadlessBlockImageNode,
  HeadlessImageNode,
  HorizontalRuleNode,
  LinkNode,
  ListItemNode,
  ListNode,
  QuoteNode,
  TableCellNode,
  TableNode,
  TableRowNode,
];

const createNoopAwareness = (): ProviderAwareness => {
  let localState: UserState | null = null;

  return {
    getLocalState: () => localState,
    getStates: () => new Map(),
    off: () => {},
    on: () => {},
    setLocalState: (state) => {
      localState = state;
    },
    setLocalStateField: (field, value) => {
      localState = {
        ...(localState ?? {
          anchorPos: null,
          awarenessData: {},
          color: '#7c3aed',
          focusPos: null,
          focusing: true,
          name: 'AI Assistant',
        }),
        [field]: value,
      };
    },
  };
};

const createHeadlessProvider = (): Provider => ({
  awareness: createNoopAwareness(),
  connect: () => {},
  disconnect: () => {},
  off: () => {},
  on: () => {},
});

const serializeRelativePosition = (position: RelativePosition): SerializedRelativePosition =>
  relativePositionToJSON(position) as SerializedRelativePosition;

const createAiPresence = (
  taskId: string,
  status: 'done' | 'thinking' | 'writing',
  anchorPosition: RelativePosition | null,
  focusPosition = anchorPosition,
): SerializedUserState => ({
  anchorPos: anchorPosition ? serializeRelativePosition(anchorPosition) : null,
  awarenessData: {
    role: 'assistant',
    status,
    taskId,
  },
  color: '#7c3aed',
  focusPos: focusPosition ? serializeRelativePosition(focusPosition) : null,
  focusing: status !== 'done',
  name: 'AI Assistant',
});

const splitStreamingText = (text: string) => {
  return Array.from(text);
};

function findOccurrenceOffset(content: string, selectedText: string, occurrenceIndex: number) {
  let index = -1;
  let searchFrom = 0;

  for (let occurrence = 0; occurrence <= occurrenceIndex; occurrence += 1) {
    index = content.indexOf(selectedText, searchFrom);
    if (index === -1) return content.indexOf(selectedText);
    searchFrom = index + selectedText.length;
  }

  return index;
}

const publishDocumentDelta = (context: AiToolExecutionContext) => {
  const update = encodeStateAsUpdate(context.doc, context.stateVector);
  context.stateVector = encodeStateVector(context.doc);

  applyDocumentUpdate(context.roomId, {
    clientID: context.doc.clientID,
    update: bytesToBase64(update),
  });
};

const publishHeadlessEditorUpdate = async (context: AiToolExecutionContext) => {
  await wait(0);
  publishDocumentDelta(context);
};

const createHeadlessCollaborationContext = (roomId: string, doc: Doc) => {
  const lexicalEditor = createHeadlessEditor({
    editable: false,
    namespace: `ai-collaboration-${roomId}`,
    nodes: HEADLESS_COLLABORATION_NODES,
    onError: (error) => {
      throw error;
    },
  });

  const provider = createHeadlessProvider();
  const binding = registerCollaborationBinding({
    doc,
    id: roomId,
    lexicalEditor,
    provider,
    syncCursorPositionsFn: () => {},
    yjsDocMap: new Map([[roomId, doc]]),
  });

  return {
    cleanup: () => {
      binding.cleanup();
    },
    lexicalEditor,
  };
};

const collectLexicalTextLeaves = (
  node: LexicalNode,
  leaves: LexicalTextLeaf[],
  cursor: { value: number },
) => {
  if ($isTextNode(node)) {
    const value = node.getTextContent();
    leaves.push({
      end: cursor.value + value.length,
      key: node.getKey(),
      node,
      start: cursor.value,
      value,
    });
    cursor.value += value.length;
    return;
  }

  if ($isElementNode(node)) {
    for (const child of node.getChildren()) {
      collectLexicalTextLeaves(child, leaves, cursor);
    }
  }
};

const findLexicalSelectedRange = (
  selection: AiSelectionRequest | undefined,
): null | {
  endLeaf: LexicalTextLeaf;
  endOffset: number;
  startLeaf: LexicalTextLeaf;
  startOffset: number;
} => {
  const selectedText = selection?.selectedText.trim();
  if (!selectedText) return null;

  const leaves: LexicalTextLeaf[] = [];
  collectLexicalTextLeaves($getRoot(), leaves, { value: 0 });

  const documentText = leaves.map((leaf) => leaf.value).join('');
  const start = findOccurrenceOffset(documentText, selectedText, selection?.occurrenceIndex ?? 0);
  if (start < 0) return null;

  const end = start + selectedText.length;
  const startLeaf = leaves.find((leaf) => start >= leaf.start && start <= leaf.end);
  const endLeaf = leaves.find((leaf) => end >= leaf.start && end <= leaf.end);

  if (!startLeaf || !endLeaf) return null;

  return {
    endLeaf,
    endOffset: end - endLeaf.start,
    startLeaf,
    startOffset: start - startLeaf.start,
  };
};

const setLexicalRangeSelection = (
  range: NonNullable<ReturnType<typeof findLexicalSelectedRange>>,
) => {
  const lexicalSelection = $createRangeSelection();
  lexicalSelection.anchor.set(range.startLeaf.key, range.startOffset, 'text');
  lexicalSelection.focus.set(range.endLeaf.key, range.endOffset, 'text');
  $setSelection(lexicalSelection);

  return lexicalSelection;
};

const getLexicalTextLeafAtOffset = (offset: number) => {
  const leaves: LexicalTextLeaf[] = [];
  collectLexicalTextLeaves($getRoot(), leaves, { value: 0 });

  return leaves.find((leaf) => offset >= leaf.start && offset <= leaf.end) ?? leaves.at(-1);
};

const insertLexicalChunkAtOffset = (
  lexicalEditor: LexicalEditor,
  absoluteOffset: number,
  chunk: string,
) => {
  let didInsert = false;

  lexicalEditor.update(
    () => {
      const leaf = getLexicalTextLeafAtOffset(absoluteOffset);
      if (!leaf) return;

      const lexicalSelection = $createRangeSelection();
      const leafOffset = Math.max(0, Math.min(absoluteOffset - leaf.start, leaf.value.length));
      lexicalSelection.anchor.set(leaf.key, leafOffset, 'text');
      lexicalSelection.focus.set(leaf.key, leafOffset, 'text');
      $setSelection(lexicalSelection);
      lexicalSelection.insertText(chunk);
      didInsert = true;
    },
    { discrete: true },
  );

  return didInsert;
};

const appendLexicalChunkToLastText = (lexicalEditor: LexicalEditor, chunk: string) => {
  lexicalEditor.update(
    () => {
      const leaves: LexicalTextLeaf[] = [];
      collectLexicalTextLeaves($getRoot(), leaves, { value: 0 });
      const leaf = leaves.at(-1);

      if (leaf) {
        leaf.node.setTextContent(`${leaf.value}${chunk}`);
        return;
      }

      const lastChild = $getRoot().getLastChild();
      if ($isElementNode(lastChild)) {
        lastChild.append($createTextNode(chunk));
      }
    },
    { discrete: true },
  );
};

interface AiSelectionRequest {
  occurrenceIndex: number;
  selectedText: string;
}

interface TextLeaf {
  attributes: Record<string, unknown> | undefined;
  end: number;
  start: number;
  text: XmlText;
  value: string;
  yEnd: number;
  yStart: number;
}

interface LocatedSelection {
  absoluteStart: number;
  anchorPosition: RelativePosition;
  endLeaf: TextLeaf;
  endOffset: number;
  focusPosition: RelativePosition;
  startLeaf: TextLeaf;
  startOffset: number;
}

interface AiToolExecutionContext {
  cleanup: () => void;
  doc: Doc;
  finalPosition: RelativePosition | null;
  insertedText: string;
  lexicalEditor: LexicalEditor;
  roomId: string;
  selection: LocatedSelection | null;
  selectionRequest: AiSelectionRequest | undefined;
  stateVector: Uint8Array;
  taskId: string;
}

interface LexicalTextLeaf {
  end: number;
  key: string;
  node: TextNode;
  start: number;
  value: string;
}

const publishPresence = (
  context: AiToolExecutionContext,
  status: 'done' | 'thinking' | 'writing',
  anchorPosition: RelativePosition | null,
  focusPosition = anchorPosition,
) => {
  applyAwarenessUpdate(context.roomId, {
    clientID: context.doc.clientID,
    state: createAiPresence(context.taskId, status, anchorPosition, focusPosition),
  });
};

const collectTextLeaves = (node: XmlElement, leaves: TextLeaf[], cursor: { value: number }) => {
  for (const child of node.toArray()) {
    if (child instanceof XmlText) {
      let yIndex = 0;

      for (const delta of child.toDelta()) {
        const insert = delta.insert;

        if (typeof insert === 'string') {
          leaves.push({
            attributes: delta.attributes as Record<string, unknown> | undefined,
            end: cursor.value + insert.length,
            start: cursor.value,
            text: child,
            value: insert,
            yEnd: yIndex + insert.length,
            yStart: yIndex,
          });
          cursor.value += insert.length;
          yIndex += insert.length;
        } else {
          yIndex += 1;
        }
      }
      continue;
    }

    if (child instanceof XmlElement) {
      collectTextLeaves(child, leaves, cursor);
    }
  }
};

const findSelectedRange = (
  doc: Doc,
  selection: AiSelectionRequest | undefined,
): LocatedSelection | null => {
  const selectedText = selection?.selectedText.trim();
  if (!selectedText) return null;

  const leaves: TextLeaf[] = [];
  collectTextLeaves(doc.get('root-v2', XmlElement), leaves, { value: 0 });

  const documentText = leaves.map((leaf) => leaf.value).join('');
  const start = findOccurrenceOffset(documentText, selectedText, selection?.occurrenceIndex ?? 0);
  if (start < 0) return null;

  const end = start + selectedText.length;
  const startLeaf = leaves.find((leaf) => start >= leaf.start && start <= leaf.end);
  const endLeaf = leaves.find((leaf) => end >= leaf.start && end <= leaf.end);

  if (!startLeaf || !endLeaf) return null;

  const startOffset = start - startLeaf.start;
  const endOffset = end - endLeaf.start;

  return {
    absoluteStart: start,
    anchorPosition: createRelativePositionFromTypeIndex(
      startLeaf.text,
      startLeaf.yStart + startOffset,
      0,
    ),
    endLeaf,
    endOffset: endLeaf.yStart + endOffset,
    focusPosition: createRelativePositionFromTypeIndex(endLeaf.text, endLeaf.yStart + endOffset, 0),
    startLeaf,
    startOffset: startLeaf.yStart + startOffset,
  };
};

const publishSelectedRangePresence = (
  context: AiToolExecutionContext,
  status: 'done' | 'thinking' | 'writing',
) => {
  if (!context.selection) return false;

  publishPresence(
    context,
    status,
    context.selection.anchorPosition,
    context.selection.focusPosition,
  );
  return true;
};

const getDocumentEndPosition = (doc: Doc) => {
  const root = doc.get('root-v2', XmlElement);

  return createRelativePositionFromTypeIndex(root, root.length, 0);
};

const appendStreamingAiParagraph = async (context: AiToolExecutionContext, content: string) => {
  context.lexicalEditor.update(
    () => {
      const root = $getRoot();
      const paragraph = $createParagraphNode();
      const text = $createTextNode('');

      paragraph.append(text);
      root.append(paragraph);
      context.finalPosition = getDocumentEndPosition(context.doc);
    },
    { discrete: true },
  );
  await publishHeadlessEditorUpdate(context);

  for (const chunk of splitStreamingText(content)) {
    await wait(STREAM_CHUNK_DELAY_MS);

    appendLexicalChunkToLastText(context.lexicalEditor, chunk);
    await publishHeadlessEditorUpdate(context);
    context.finalPosition = getDocumentEndPosition(context.doc);
    publishPresence(context, 'writing', context.finalPosition);
  }
};

const getYTextPositionAtOffset = (doc: Doc, offset: number) => {
  const leaves: TextLeaf[] = [];
  collectTextLeaves(doc.get('root-v2', XmlElement), leaves, { value: 0 });

  const leaf = leaves.find((item) => offset >= item.start && offset <= item.end) ?? leaves.at(-1);
  if (!leaf) return getDocumentEndPosition(doc);

  const leafOffset = Math.max(0, Math.min(offset - leaf.start, leaf.yEnd - leaf.yStart));

  return createRelativePositionFromTypeIndex(leaf.text, leaf.yStart + leafOffset, 0);
};

const replaceSelectionWithStreamingText = async (
  context: AiToolExecutionContext,
  replacementText: string,
) => {
  const selection = context.selection;
  if (!selection) {
    await appendStreamingAiParagraph(context, replacementText);
    return;
  }

  let didRemoveSelection = false;
  let insertedLength = 0;

  context.lexicalEditor.update(
    () => {
      const lexicalRange = findLexicalSelectedRange(context.selectionRequest);
      if (!lexicalRange) return;

      const lexicalSelection = setLexicalRangeSelection(lexicalRange);
      lexicalSelection.removeText();
      didRemoveSelection = true;
    },
    { discrete: true },
  );

  if (!didRemoveSelection) {
    await appendStreamingAiParagraph(context, replacementText);
    return;
  }

  context.finalPosition = getYTextPositionAtOffset(context.doc, selection.absoluteStart);
  publishPresence(context, 'writing', context.finalPosition);
  await publishHeadlessEditorUpdate(context);

  for (const chunk of splitStreamingText(replacementText)) {
    await wait(STREAM_CHUNK_DELAY_MS);

    const didInsert = insertLexicalChunkAtOffset(
      context.lexicalEditor,
      selection.absoluteStart + insertedLength,
      chunk,
    );
    if (!didInsert) return;

    await publishHeadlessEditorUpdate(context);
    insertedLength += chunk.length;
    context.finalPosition = getYTextPositionAtOffset(
      context.doc,
      selection.absoluteStart + insertedLength,
    );
    publishPresence(context, 'writing', context.finalPosition);
  }
};

const executeToolCall = async (context: AiToolExecutionContext, toolCall: AiToolCall) => {
  switch (toolCall.name) {
    case 'set_ai_selection': {
      if (
        toolCall.input.target === 'selected_range' &&
        publishSelectedRangePresence(context, 'thinking')
      ) {
        await wait(250);
        return;
      }

      const position = getDocumentEndPosition(context.doc);
      context.finalPosition = position;
      publishPresence(context, 'thinking', position);
      await wait(250);
      return;
    }

    case 'append_paragraph': {
      publishPresence(context, 'writing', context.finalPosition);
      await wait(250);

      context.insertedText = toolCall.input.text;
      await appendStreamingAiParagraph(context, toolCall.input.text);
      return;
    }

    case 'replace_selection': {
      publishSelectedRangePresence(context, 'writing');
      await wait(250);

      context.insertedText = toolCall.input.text;
      await replaceSelectionWithStreamingText(context, toolCall.input.text);
      return;
    }

    case 'finish_task': {
      publishPresence(context, 'done', context.finalPosition);
      return;
    }
  }
};

export const runAiTask = async (
  roomId: string,
  prompt: string,
  selectionRequest?: AiSelectionRequest,
) => {
  const doc = new Doc();
  const taskId = createTaskId();
  const snapshot = getSnapshotUpdate(roomId);

  if (snapshot) {
    applyUpdate(doc, snapshot);
  }

  const headlessContext = createHeadlessCollaborationContext(roomId, doc);

  const context: AiToolExecutionContext = {
    cleanup: headlessContext.cleanup,
    doc,
    finalPosition: null,
    insertedText: '',
    lexicalEditor: headlessContext.lexicalEditor,
    roomId,
    selection: findSelectedRange(doc, selectionRequest),
    selectionRequest,
    stateVector: encodeStateVector(doc),
    taskId,
  };

  try {
    clearAssistantAwareness(roomId);

    if (context.selection) {
      publishSelectedRangePresence(context, 'thinking');
    }

    const selectionPresencePublishedAt = context.selection ? Date.now() : 0;
    const toolCalls = await runAnthropicModel(prompt, selectionRequest?.selectedText);

    if (context.selection) {
      const elapsed = Date.now() - selectionPresencePublishedAt;
      await wait(Math.max(0, SELECTED_RANGE_HANDOFF_DWELL_MS - elapsed));
    }

    for (const toolCall of toolCalls) {
      await executeToolCall(context, toolCall);
    }

    return {
      clientID: doc.clientID,
      insertedText: context.insertedText,
      ok: true,
      systemPrompt: AI_COLLABORATION_SYSTEM_PROMPT,
      taskId,
      toolCalls,
      tools: aiToolDefinitions,
    };
  } finally {
    context.cleanup();
  }
};
