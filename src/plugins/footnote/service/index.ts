import { genServiceId } from '@/editor-kernel';
import type { IServiceID } from '@/types';

import type { FootnoteState } from '../utils';

export interface FootnoteSnapshot {
  definitions: Record<string, string>;
  numbers: Record<string, number>;
}

export interface IFootnoteService {
  getSnapshot(): FootnoteSnapshot;
  subscribe(listener: () => void): () => void;
}

export const IFootnoteService: IServiceID<IFootnoteService> =
  genServiceId<IFootnoteService>('FootnoteService');

const EMPTY_SNAPSHOT: FootnoteSnapshot = { definitions: {}, numbers: {} };

export class FootnoteService implements IFootnoteService {
  private snapshot: FootnoteSnapshot = EMPTY_SNAPSHOT;
  private signature = '';
  private listeners = new Set<() => void>();

  getSnapshot = (): FootnoteSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  update(state: FootnoteState): void {
    const snapshot: FootnoteSnapshot = {
      definitions: Object.fromEntries(
        Array.from(state.definitions, ([identifier, { text }]) => [identifier, text]),
      ),
      numbers: Object.fromEntries(state.numbers),
    };
    const signature = JSON.stringify(snapshot);
    if (signature === this.signature) return;

    this.signature = signature;
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}
