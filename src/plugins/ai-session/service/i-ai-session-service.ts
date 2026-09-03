import type { LexicalEditor } from 'lexical';

import { genServiceId } from '@/editor-kernel';
import type { IServiceID } from '@/types';

import type {
  AISessionHighlightKind,
  AISessionMark,
  AISessionRange,
  AISessionRangeInput,
} from '../types';

export interface IAISessionService {
  applyAISessionMark(range: AISessionRangeInput, mark: AISessionMark): void;
  bindEditor(editor: LexicalEditor): void;
  clearAISessionMarks(sessionId?: string): void;
  clearSessionFocus(): void;
  focusSession(sessionId: string | null): void;
  getActiveSessionId(): string | null;
  getAISessionRanges(sessionId: string): AISessionRange[];
  getHoveredSessionId(): string | null;
  getRangeBySessionId(sessionId: string): AISessionRange[];
  getRanges(sessionId: string): AISessionRange[];
  refresh(): void;
  refreshHighlights(): void;
  removeAISessionMark(range: AISessionRangeInput): void;
  setActiveSessionId(sessionId: string | null): void;
  setHoveredSessionId(sessionId: string | null): void;
  setSessionHighlight(kind: AISessionHighlightKind, sessionId: string | null): void;
  subscribe(listener: () => void): () => void;
}

export const IAISessionService: IServiceID<IAISessionService> = genServiceId<IAISessionService>(
  'AISessionService',
);
