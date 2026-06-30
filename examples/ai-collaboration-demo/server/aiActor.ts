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

const createEmptyParagraph = () => {
  const paragraph = new XmlElement('paragraph');
  const text = new XmlText();

  paragraph.insert(0, [text]);

  return {
    paragraph,
    text,
  };
};

const splitStreamingText = (text: string) => {
  return Array.from(text);
};

const publishDocumentDelta = (context: AiToolExecutionContext) => {
  const update = encodeStateAsUpdate(context.doc, context.stateVector);
  context.stateVector = encodeStateVector(context.doc);

  applyDocumentUpdate(context.roomId, {
    clientID: context.doc.clientID,
    update: bytesToBase64(update),
  });
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
  anchorPosition: RelativePosition;
  endLeaf: TextLeaf;
  endOffset: number;
  focusPosition: RelativePosition;
  startLeaf: TextLeaf;
  startOffset: number;
}

interface AiToolExecutionContext {
  doc: Doc;
  finalPosition: RelativePosition | null;
  insertedText: string;
  roomId: string;
  selection: LocatedSelection | null;
  stateVector: Uint8Array;
  taskId: string;
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

const findOccurrenceOffset = (content: string, selectedText: string, occurrenceIndex: number) => {
  let index = -1;
  let searchFrom = 0;

  for (let occurrence = 0; occurrence <= occurrenceIndex; occurrence += 1) {
    index = content.indexOf(selectedText, searchFrom);
    if (index === -1) return content.indexOf(selectedText);
    searchFrom = index + selectedText.length;
  }

  return index;
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

const appendStreamingAiParagraph = async (context: AiToolExecutionContext, content: string) => {
  const root = context.doc.get('root-v2', XmlElement);
  const { paragraph, text } = createEmptyParagraph();
  let offset = 0;

  root.insert(root.length, [paragraph]);
  context.finalPosition = createRelativePositionFromTypeIndex(text, 0, 0);
  publishDocumentDelta(context);

  for (const chunk of splitStreamingText(content)) {
    await wait(STREAM_CHUNK_DELAY_MS);

    text.insert(offset, chunk);
    offset += chunk.length;
    context.finalPosition = createRelativePositionFromTypeIndex(text, offset, 0);
    publishPresence(context, 'writing', context.finalPosition);
    publishDocumentDelta(context);
  }
};

const getDocumentEndPosition = (doc: Doc) => {
  const root = doc.get('root-v2', XmlElement);

  return createRelativePositionFromTypeIndex(root, root.length, 0);
};

const collectSelectedLeaves = (doc: Doc, selection: LocatedSelection) => {
  const leaves: TextLeaf[] = [];
  collectTextLeaves(doc.get('root-v2', XmlElement), leaves, { value: 0 });

  const startIndex = leaves.findIndex(
    (leaf) => leaf.text === selection.startLeaf.text && leaf.yStart === selection.startLeaf.yStart,
  );
  const endIndex = leaves.findIndex(
    (leaf) => leaf.text === selection.endLeaf.text && leaf.yStart === selection.endLeaf.yStart,
  );

  if (startIndex === -1 || endIndex === -1) return [selection.startLeaf];

  return leaves.slice(startIndex, endIndex + 1);
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

  const leaves = collectSelectedLeaves(context.doc, selection);
  let insertOffset = selection.startOffset;

  if (selection.startLeaf.text === selection.endLeaf.text) {
    const deleteLength = Math.max(0, selection.endOffset - selection.startOffset);

    context.doc.transact(() => {
      selection.startLeaf.text.applyDelta([
        { retain: selection.startOffset },
        { delete: deleteLength },
      ]);
    });
  } else {
    context.doc.transact(() => {
      for (const leaf of leaves.reverse()) {
        const deleteStart = leaf === selection.startLeaf ? selection.startOffset : leaf.yStart;
        const deleteEnd = leaf === selection.endLeaf ? selection.endOffset : leaf.yEnd;
        const deleteLength = Math.max(0, deleteEnd - deleteStart);

        if (deleteLength > 0) {
          leaf.text.applyDelta([{ retain: deleteStart }, { delete: deleteLength }]);
        }
      }
    });
  }

  context.finalPosition = createRelativePositionFromTypeIndex(
    selection.startLeaf.text,
    insertOffset,
    0,
  );
  publishPresence(context, 'writing', context.finalPosition);
  publishDocumentDelta(context);

  for (const chunk of splitStreamingText(replacementText)) {
    await wait(STREAM_CHUNK_DELAY_MS);

    selection.startLeaf.text.applyDelta([
      { retain: insertOffset },
      {
        attributes: selection.startLeaf.attributes,
        insert: chunk,
      },
    ]);
    insertOffset += chunk.length;
    context.finalPosition = createRelativePositionFromTypeIndex(
      selection.startLeaf.text,
      insertOffset,
      0,
    );
    publishPresence(context, 'writing', context.finalPosition);
    publishDocumentDelta(context);
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

  const context: AiToolExecutionContext = {
    doc,
    finalPosition: null,
    insertedText: '',
    roomId,
    selection: findSelectedRange(doc, selectionRequest),
    stateVector: encodeStateVector(doc),
    taskId,
  };

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
};
