import type { ILocaleKeys } from '@/types';

export interface ReactTablePluginProps {
  className?: string;
  locale?: Partial<Record<keyof ILocaleKeys, string>>;
}
