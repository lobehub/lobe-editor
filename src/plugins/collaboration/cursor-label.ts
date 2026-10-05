/**
 * Engine-neutral cursor label formatting and loading-dot styling.
 *
 * Both collaboration engines project the same awareness role/status contract
 * into different cursor implementations. Keeping the display policy here
 * prevents those projections from drifting while leaving their CRDT payloads
 * private to the engine adapters.
 */

export interface CollaborationCursorLabelInput {
  name: string;
  role?: string;
  status?: string;
}

export interface CollaborationCursorLabel {
  label: string;
  loading?: boolean;
}

export type CollaborationCursorLabelFormatter = (
  input: CollaborationCursorLabelInput,
) => CollaborationCursorLabel | string;

export type CollaborationCursorLabelTranslationKey =
  | 'collaboration.aiAgent'
  | 'collaboration.aiAgentAwaitingReview'
  | 'collaboration.aiAgentConnecting'
  | 'collaboration.aiAgentSyncing'
  | 'collaboration.aiAgentThinking'
  | 'collaboration.aiAgentWriting';

const DEFAULT_AWARENESS_LABELS: Record<CollaborationCursorLabelTranslationKey, string> = {
  'collaboration.aiAgent': 'AI Agent',
  'collaboration.aiAgentAwaitingReview': 'AI Agent (awaiting review…)',
  'collaboration.aiAgentConnecting': 'AI Agent (connecting…)',
  'collaboration.aiAgentSyncing': 'AI Agent (syncing…)',
  'collaboration.aiAgentThinking': 'AI Agent (thinking…)',
  'collaboration.aiAgentWriting': 'AI Agent (typing…)',
};

const ACTIVE_AGENT_STATUSES = new Set([
  'awaiting-review',
  'connecting',
  'syncing',
  'thinking',
  'writing',
]);

const AGENT_STATUS_KEYS: Partial<Record<string, CollaborationCursorLabelTranslationKey>> = {
  'awaiting-review': 'collaboration.aiAgentAwaitingReview',
  'connecting': 'collaboration.aiAgentConnecting',
  'syncing': 'collaboration.aiAgentSyncing',
  'thinking': 'collaboration.aiAgentThinking',
  'writing': 'collaboration.aiAgentWriting',
};

const DEFAULT_AGENT_NAME = 'AI Agent';

/**
 * Format an awareness label without changing ordinary collaborator names.
 *
 * The original Yjs path used a translated "AI Agent" label for every Agent,
 * which hid a custom Agent name. Preserve that compatibility for the default
 * name while replacing the translated prefix when a caller supplies a custom
 * Agent name.
 */
export const formatCollaborationCursorLabel = (
  input: CollaborationCursorLabelInput,
  translate: (key: CollaborationCursorLabelTranslationKey) => string = (key) =>
    DEFAULT_AWARENESS_LABELS[key],
): CollaborationCursorLabel => {
  if (input.role !== 'agent') return { label: input.name, loading: false };

  const status = input.status;
  const key = status ? AGENT_STATUS_KEYS[status] : undefined;
  const translatedBase = translate('collaboration.aiAgent');
  const name = input.name || translatedBase || DEFAULT_AGENT_NAME;
  const usesDefaultName = name === DEFAULT_AGENT_NAME || name === translatedBase;
  if (!key) return { label: usesDefaultName ? translatedBase : name, loading: false };

  const translated = translate(key);
  const label = usesDefaultName
    ? translated
    : translated.startsWith(translatedBase)
      ? `${name}${translated.slice(translatedBase.length)}`
      : `${name} · ${translated}`;

  return {
    label,
    loading: status !== undefined && ACTIVE_AGENT_STATUSES.has(status),
  };
};

export const COLLABORATION_AGENT_LOADING_DOT_CLASS = 'lobe-collaboration-agent-loading-dot';

const COLLABORATION_AGENT_STYLE_ID = 'lobe-collaboration-agent-cursor-styles';

/** Install the shared loading-dot animation once per document. */
export const ensureCollaborationAgentCursorStyles = (
  styleId = COLLABORATION_AGENT_STYLE_ID,
): void => {
  if (typeof document === 'undefined' || document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes lobe-collaboration-agent-loading-dot {
      0%, 100% { opacity: .28; transform: scale(.82); }
      50% { opacity: 1; transform: scale(1); }
    }
    .${COLLABORATION_AGENT_LOADING_DOT_CLASS},
    .lobe-yjs-agent-loading-dot {
      display: inline-block;
      margin-left: 3px;
      animation: lobe-collaboration-agent-loading-dot 1.1s ease-in-out infinite;
    }
  `;
  document.head.append(style);
};
