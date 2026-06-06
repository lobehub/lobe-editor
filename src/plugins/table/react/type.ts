import type { ILocaleKeys } from '@/types';

export type TableResizeMode = 'realtime' | 'deferred';

export interface ReactTablePluginProps {
  className?: string;
  locale?: Partial<Record<keyof ILocaleKeys, string>>;
  resizeMode?: TableResizeMode;
}
