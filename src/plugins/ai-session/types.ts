import type { BaseSelection } from 'lexical';

/** Opaque provenance supplied by the Page/AI host for generated text. */
export interface AISessionMark {
  requestId?: string;
  sessionId: string;
  turnIndex?: number;
}

/** One current marked text segment, addressed by the live Lexical node key. */
export interface AISessionRange extends AISessionMark {
  end: number;
  endOffset: number;
  key: string;
  nodeKey: string;
  start: number;
  startOffset: number;
  text: string;
}

export type AISessionRangeInput = BaseSelection;

export type AISessionHighlightKind = 'active' | 'hover';

export const AI_SESSION_ACTIVE_CLASS = 'ai-session-active';
export const AI_SESSION_HOVER_CLASS = 'ai-session-hover';

/** CSS Custom Highlight names used for the editor-owned session projections. */
export const AI_SESSION_ACTIVE_HIGHLIGHT_NAME = 'ai-session-active';
export const AI_SESSION_HOVER_HIGHLIGHT_NAME = 'ai-session-hover';
