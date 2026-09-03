import type { CommandPayloadType, SerializedEditorState, SerializedLexicalNode } from 'lexical';

import Editor, { moment } from '@/editor-kernel';
import {
  LITEXML_APPLY_COMMAND,
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LITEXML_REMOVE_COMMAND,
} from '@/plugins/litexml/command';
import type { IDocumentOptions, IEditor, IPlugin } from '@/types';

import { DEFAULT_HEADLESS_EDITOR_PLUGINS } from './default-plugins';

export type {
  BlockRewriteSelection,
  CollaborativeAgentCommand,
  CollaborativeAgentEditorConnectOptions,
  CollaborativeRewriteSelection,
  CollaborativeRewriteStreamAbortInput,
  CollaborativeRewriteStreamAppendInput,
  CollaborativeRewriteStreamFinalizeInput,
  CollaborativeRewriteStreamRecoveryInput,
  CollaborativeRewriteStreamResult,
  CollaborativeRewriteStreamSession,
  CollaborativeRewriteStreamStartInput,
  CollaborativeRewriteStreamStatus,
  ResolvedRewriteSelection,
  RewriteSelection,
  RewriteTargetInspection,
  SerializedRewriteSelection,
} from './collaborative-agent-editor';
export {
  CollaborativeAgentEditor,
  deserializeRelativePosition,
  hashRewriteText,
  serializeRelativePosition,
} from './collaborative-agent-editor';
export { DEFAULT_HEADLESS_EDITOR_PLUGINS } from './default-plugins';
export type { ExportYjsSnapshotProjectionInput, YjsSnapshotProjection } from './yjs-snapshot';
export { exportYjsSnapshotProjection } from './yjs-snapshot';
export type {
  AgentAwarenessData,
  AgentAwarenessInput,
  AgentAwarenessState,
  AgentAwarenessStatus,
  AgentCaretAnchor,
  AgentRewriteRange,
  NodeWebSocketYjsProviderOptions,
  RefreshTicket,
  SerializedRelativePosition,
  SerializedUserState,
} from '@/plugins/yjs';

// Targeted rewrite is exported from the headless entry so a Node Agent can
// share the exact command symbol/gateway with the browser bundle.
export type {
  AISessionHighlightKind,
  AISessionMark,
  AISessionRange,
  AISessionRangeInput,
} from '@/plugins/ai-session';
export {
  $applyAISessionMark,
  $removeAISessionMark,
  AISessionService,
  IAISessionService,
} from '@/plugins/ai-session/service';
export type {
  CollaborativeAgentCommandGateway,
  LiteXMLInsertCommandPayload,
  LiteXMLModifyCommandOperation,
  LiteXMLModifyCommandPayload,
  LiteXMLRemoveCommandPayload,
  LiteXMLReviewCommandPayload,
  LiteXMLRewriteMetadata,
  LiteXMLValidationOptions,
  PendingRewriteReview,
  RewriteCommandResult,
  RewriteCommandResultChannel,
  RewriteCommandStatus,
  RewriteRangeCommandPayload,
  RewriteRangeMode,
  RewriteReviewEvent,
  RewriteReviewListener,
  RewriteReviewSettlementInput,
  RewriteReviewSettlementResult,
  RewriteSelectionInput,
  SerializedBlockRewriteSelection,
  SerializedRewritePoint,
} from '@/plugins/litexml/command';
export {
  COLLABORATIVE_AGENT_COMMAND_ALLOWLIST,
  createAgentCommandGateway,
  createCollaborativeAgentCommandGateway,
  InMemoryRewriteCommandResultChannel,
  IRewriteCommandResultService,
  IRewriteReviewService,
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LITEXML_REMOVE_COMMAND,
  LITEXML_REVIEW_COMMAND,
  LITEXML_REWRITE_RANGE_COMMAND,
  normalizeRewriteText,
  RewriteReviewService,
  validateLiteXMLInput,
} from '@/plugins/litexml/command';
export { MARK_AI_GENERATED_COMMAND } from '@/plugins/properties/command';
export {
  createAgentYjsProvider,
  createNodeWebSocketYjsProvider,
  NodeWebSocketYjsProvider,
} from '@/plugins/yjs/node-websocket-provider';
export {
  decodeBase64,
  decodeYjsBase64,
  encodeBase64,
  encodeYjsBase64,
  isAgentCaretAnchor,
  isAgentRewriteRange,
  LOBE_YJS_PROTOCOL,
  LOBE_YJS_PROTOCOL_VERSION,
  parseLobeYjsMessage,
  YJS_PROTOCOL,
  YJS_PROTOCOL_VERSION,
} from '@/plugins/yjs/protocol';

// Durable node identity is part of the headless/agent surface as well as the
// browser bundle. Re-export the primitives here so a Node collaborator can
// resolve and migrate targets without importing the DOM entrypoint.
export type { FileListItem, ImageListItem, MediaLists } from './extract-media-from-editor-state';
export { extractMediaFromEditorState } from './extract-media-from-editor-state';
export type {
  NodeIdentityMigrationOptions,
  NodeIdentityMigrationResult,
  NodeProperties,
} from '@/plugins/properties';
export {
  createDeterministicNodeId,
  createNodeId,
  isNodeId,
  propertiesState,
} from '@/plugins/properties/state';
export {
  $ensureNodeId,
  $ensureNodeIdsInTree,
  $findNodeById,
  $findNodesById,
  $getNodeById,
  $getNodeId,
  $isNodeIdentityBlockTarget,
  $isNodeIdentityTarget,
  $migrateNodeIds,
  $preserveNodeIdentity,
  $resolveNodeIds,
  $setNodeId,
} from '@/plugins/properties/utils';

export type HeadlessDocumentType = 'json' | 'litexml' | 'markdown' | (string & object);

export interface HeadlessEditorHydrationInput {
  content: unknown;
  options?: IDocumentOptions;
  type: HeadlessDocumentType;
}

export interface HeadlessEditorExportOptions {
  /**
   * Include the invisible `lobe-node-id` Markdown transport comments. The
   * default is presentation Markdown; editorData remains the canonical
   * persistence projection when metadata is omitted.
   */
  includeNodeIds?: boolean;
  litexml?: boolean;
}

export interface HeadlessEditorExport {
  editorData: SerializedEditorState<SerializedLexicalNode>;
  litexml?: string;
  markdown: string;
}

export interface HeadlessEditorOptions {
  additionalPlugins?: ReadonlyArray<IPlugin>;
  initialValue?: HeadlessEditorHydrationInput;
  plugins?: ReadonlyArray<IPlugin>;
}

export interface HeadlessLiteXMLReplaceOperation {
  action: 'apply' | 'replace';
  delay?: boolean;
  litexml: string | string[];
}

export type HeadlessLiteXMLInsertOperation =
  | {
      action: 'insert';
      afterId: string;
      delay?: boolean;
      litexml: string;
    }
  | {
      action: 'insert';
      beforeId: string;
      delay?: boolean;
      litexml: string;
    };

export interface HeadlessLiteXMLRemoveOperation {
  action: 'remove';
  delay?: boolean;
  id: string;
}

export interface HeadlessLiteXMLBatchOperation {
  action: 'batch';
  operations: CommandPayloadType<typeof LITEXML_MODIFY_COMMAND>;
}

export type HeadlessLiteXMLOperation =
  | HeadlessLiteXMLBatchOperation
  | HeadlessLiteXMLInsertOperation
  | HeadlessLiteXMLRemoveOperation
  | HeadlessLiteXMLReplaceOperation;

type SerializedRecord = Record<string, unknown>;

interface NormalizeLegacyEditorDataContext {
  nextId: number;
}

const getNumericId = (id: unknown): number | null => {
  if (typeof id !== 'number' && typeof id !== 'string') return null;

  const numericId = Number(id);
  return Number.isInteger(numericId) && numericId >= 0 ? numericId : null;
};

const findMaxSerializedId = (node: unknown): number => {
  if (!node || typeof node !== 'object') return -1;

  const record = node as SerializedRecord;
  const id = getNumericId(record.id);
  const ownMax = id ?? -1;

  if (!Array.isArray(record.children)) return ownMax;

  return record.children.reduce(
    (maxId: number, child: unknown) => Math.max(maxId, findMaxSerializedId(child)),
    ownMax,
  );
};

const createSerializedId = (context: NormalizeLegacyEditorDataContext) => String(context.nextId++);

const createCodeChildrenFromLegacyCode = (
  code: string,
  context: NormalizeLegacyEditorDataContext,
) =>
  code.split('\n').flatMap((text, index, array) => {
    const textNode = {
      detail: 0,
      format: 0,
      id: createSerializedId(context),
      mode: 'normal',
      style: '',
      text,
      type: 'code-highlight',
      version: 1,
    };

    if (index === array.length - 1) {
      return textNode;
    }

    return [
      textNode,
      {
        id: createSerializedId(context),
        type: 'linebreak',
        version: 1,
      },
    ];
  });

const normalizeLegacyEditorDataNode = (
  node: unknown,
  context: NormalizeLegacyEditorDataContext,
): unknown => {
  if (!node || typeof node !== 'object') return node;

  const record = node as SerializedRecord;
  const children = Array.isArray(record.children)
    ? record.children.map((child: unknown) => normalizeLegacyEditorDataNode(child, context))
    : record.children;

  if (record.type === 'code' && typeof record.code === 'string' && !Array.isArray(children)) {
    return {
      ...record,
      children: createCodeChildrenFromLegacyCode(record.code, context),
      direction: record.direction ?? 'ltr',
      format: record.format ?? '',
      indent: record.indent ?? 0,
      language: record.language ?? 'plaintext',
      theme: record.theme ?? record.codeTheme,
    };
  }

  if (Array.isArray(children)) {
    return {
      ...record,
      children,
    };
  }

  return record;
};

const normalizeLegacyEditorData = (
  editorData: SerializedEditorState<SerializedLexicalNode> | string,
): SerializedEditorState<SerializedLexicalNode> | string => {
  const data =
    typeof editorData === 'string'
      ? (JSON.parse(editorData) as SerializedEditorState<SerializedLexicalNode>)
      : editorData;

  const context = {
    nextId: findMaxSerializedId(data.root) + 1,
  };

  return {
    ...data,
    root: normalizeLegacyEditorDataNode(data.root, context),
  } as SerializedEditorState<SerializedLexicalNode>;
};

const extractSerializedCodeText = (children: unknown[]): string =>
  children
    .map((child) => {
      if (!child || typeof child !== 'object') return '';

      const record = child as SerializedRecord;

      if (record.type === 'linebreak') return '\n';
      if (record.type === 'tab') return '\t';
      if (typeof record.text === 'string') return record.text;
      if (Array.isArray(record.children)) return extractSerializedCodeText(record.children);

      return '';
    })
    .join('');

const preserveSerializedCodeText = (node: unknown): unknown => {
  if (!node || typeof node !== 'object') return node;

  const record = node as SerializedRecord;
  const children = Array.isArray(record.children)
    ? record.children.map((child: unknown) => preserveSerializedCodeText(child))
    : record.children;

  if (record.type === 'code' && Array.isArray(children)) {
    return {
      ...record,
      children,
      code: extractSerializedCodeText(children),
    };
  }

  if (Array.isArray(children)) {
    return {
      ...record,
      children,
    };
  }

  return record;
};

const preserveSerializedCodeTextInEditorData = (
  editorData: SerializedEditorState<SerializedLexicalNode>,
): SerializedEditorState<SerializedLexicalNode> =>
  ({
    ...editorData,
    root: preserveSerializedCodeText(editorData.root),
  }) as SerializedEditorState<SerializedLexicalNode>;

const stripMarkdownNodeIdMarkers = (markdown: string): string =>
  markdown.replaceAll(/^[ \t]*<!--\s*lobe-node-ids?:[^\n]*-->[ \t]*(?:\r?\n[ \t]*)*/gim, '');

export class HeadlessEditor {
  readonly kernel: IEditor;

  constructor(options: HeadlessEditorOptions = {}) {
    this.kernel = Editor.createEditor();

    const plugins = [
      ...(options.plugins ?? DEFAULT_HEADLESS_EDITOR_PLUGINS),
      ...(options.additionalPlugins ?? []),
    ];

    this.kernel.registerPlugins(plugins);
    this.kernel.initHeadlessEditor();

    if (options.initialValue) {
      this.hydrate(options.initialValue);
    }
  }

  hydrate(input: HeadlessEditorHydrationInput): this {
    this.kernel.setDocument(input.type, input.content, input.options);
    return this;
  }

  hydrateEditorData(
    editorData: SerializedEditorState<SerializedLexicalNode> | string,
    options?: IDocumentOptions,
  ): this {
    this.kernel.setDocument('json', normalizeLegacyEditorData(editorData), options);
    return this;
  }

  hydrateLiteXML(litexml: string, options?: IDocumentOptions): this {
    this.kernel.setDocument('litexml', litexml, options);
    return this;
  }

  hydrateMarkdown(markdown: string, options?: IDocumentOptions): this {
    this.kernel.setDocument('markdown', markdown, options);
    return this;
  }

  async applyLiteXML(
    operation: HeadlessLiteXMLOperation | ReadonlyArray<HeadlessLiteXMLOperation>,
  ): Promise<this> {
    const operations = Array.isArray(operation) ? operation : [operation];

    for (const item of operations) {
      this.applyLiteXMLOperation(item);
    }

    await moment();
    return this;
  }

  async applyLiteXMLBatch(
    operations: CommandPayloadType<typeof LITEXML_MODIFY_COMMAND>,
  ): Promise<this> {
    this.kernel.dispatchCommand(LITEXML_MODIFY_COMMAND, operations);
    await moment();
    return this;
  }

  export(options: HeadlessEditorExportOptions = {}): HeadlessEditorExport {
    const markdown = this.kernel.getDocument('markdown', {
      includeNodeIds: options.includeNodeIds,
    }) as unknown as string;
    const snapshot: HeadlessEditorExport = {
      editorData: preserveSerializedCodeTextInEditorData(
        this.kernel.getDocument('json') as unknown as SerializedEditorState<SerializedLexicalNode>,
      ),
      markdown: options.includeNodeIds ? markdown : stripMarkdownNodeIdMarkers(markdown),
    };

    if (options.litexml) {
      snapshot.litexml = this.kernel.getDocument('litexml') as unknown as string;
    }

    return snapshot;
  }

  exportState(options?: HeadlessEditorExportOptions): HeadlessEditorExport {
    return this.export(options);
  }

  destroy(): void {
    this.kernel.destroy();
  }

  private applyLiteXMLOperation(operation: HeadlessLiteXMLOperation): void {
    switch (operation.action) {
      case 'apply':
      case 'replace': {
        this.kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
          delay: operation.delay,
          litexml: operation.litexml,
        });
        return;
      }

      case 'batch': {
        this.kernel.dispatchCommand(LITEXML_MODIFY_COMMAND, operation.operations);
        return;
      }

      case 'insert': {
        this.kernel.dispatchCommand(LITEXML_INSERT_COMMAND, operation);
        return;
      }

      case 'remove': {
        this.kernel.dispatchCommand(LITEXML_REMOVE_COMMAND, {
          delay: operation.delay,
          id: operation.id,
        });
        return;
      }
    }
  }
}

export function createHeadlessEditor(options?: HeadlessEditorOptions): HeadlessEditor {
  return new HeadlessEditor(options);
}
