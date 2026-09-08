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
  ResolvedBlockRewriteTarget,
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
export type {
  CreateImmutableYjsSnapshotFromEditorDataInput,
  ExportYjsSnapshotProjectionInput,
  ImmutableYjsSnapshot,
  LegacyBlockImageMigrationResult,
  MigrateLegacyBlockImagesInYjsDocInput,
  YjsSnapshotProjection,
} from './yjs-snapshot';
export {
  createImmutableYjsSnapshotFromEditorData,
  exportYjsSnapshotProjection,
  migrateLegacyBlockImagesInYjsDoc,
} from './yjs-snapshot';
export { extractArtifactTitle, normalizeArtifactTitle } from '@/plugins/artifact/rewrite-utils';
export {
  APPLY_BLOCK_REWRITE_COMMAND,
  type ApplyBlockRewritePayload,
} from '@/plugins/block/command';
export type {
  BlockRewriteAdapter,
  BlockRewriteApplyMetadata,
  BlockRewriteCapabilities,
  BlockRewriteContext,
  BlockRewriteImageContext,
  BlockRewriteOutput,
  BlockRewriteOutputSchema,
  BlockRewritePatchOutput,
  BlockRewriteSourceOutput,
  BlockRewriteValidationResult,
  ResolvedRewriteAdapterTarget,
} from '@/plugins/block/service/rewrite-adapter';
export { resolveRewriteAdapterTarget } from '@/plugins/block/service/rewrite-adapter';
export type {
  EditorDiagnosticsCommand,
  EditorDiagnosticsCommandEntry,
  EditorDiagnosticsEntry,
  EditorDiagnosticsNativeEntry,
  EditorDiagnosticsNativeEvent,
  EditorDiagnosticsPoint,
  EditorDiagnosticsSelection,
  EditorDiagnosticsSelectionType,
  EditorDiagnosticsShortcut,
  EditorDiagnosticsTarget,
  EditorDiagnosticsUpdateEntry,
} from '@/plugins/common/service/i-editor-diagnostics-service';
export { IEditorDiagnosticsService } from '@/plugins/common/service/i-editor-diagnostics-service';
export type {
  HoleBoundaryChange,
  HoleBoundaryPosition,
  HoleBoundarySide,
  HoleBoundaryState,
} from '@/plugins/common/service/i-hole-service';
export { IHoleService } from '@/plugins/common/service/i-hole-service';
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
  getRewriteService,
  InMemoryRewriteCommandResultChannel,
  IRewriteCommandResultService,
  IRewriteReviewService,
  IRewriteService,
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LITEXML_REMOVE_COMMAND,
  LITEXML_REVIEW_COMMAND,
  LITEXML_REWRITE_RANGE_COMMAND,
  normalizeRewriteText,
  RewriteReviewService,
  RewriteService,
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
export { canonicalizeMarkdownRewriteText, getSerializedTextContent } from '@/utils/rewrite-text';

// Durable node identity is part of the headless/agent surface as well as the
// browser bundle. Re-export the primitives here so a Node collaborator can
// resolve and migrate targets without importing the DOM entrypoint.
export type { FileListItem, ImageListItem, MediaLists } from './extract-media-from-editor-state';
export { extractMediaFromEditorState } from './extract-media-from-editor-state';
export * from './headless-editor';
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
