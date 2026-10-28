import type { IServiceID } from '@/types';

export interface IHeadingService {
  getSlug(key: string): string | null;
  isFolded(key: string): boolean;
  setFolded(key: string, folded: boolean): void;
  subscribe(listener: () => void): () => void;
  toggleFolded(key: string): void;
}

export const IHeadingService: IServiceID<IHeadingService> = {
  __serviceId: 'HeadingService',
};

export const HEADING_FOLDED_ATTRIBUTE = 'data-heading-folded';
export const HEADING_HIDDEN_ATTRIBUTE = 'data-heading-hidden';
