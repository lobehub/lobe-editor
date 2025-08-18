/**
 * Internationalization key type declaration, plugins can extend through declaration merging
 */
// Infer type from locale file
export type LocaleType = typeof import('@/locale').default;

// Recursively flatten nested key paths into flat string union types
type FlattenKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? Prefix extends ''
      ? K
      : `${Prefix}.${K}`
    : T[K] extends Record<string, any>
      ? FlattenKeys<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>
      : never;
}[keyof T & string];

// i18next style t function type
export type TFunction = <TKey extends FlattenKeys<LocaleType>>(
  key: TKey,
  options?: Record<string, string | number>,
) => string;

// Auto-inferred i18n key type base interface
export type ILocaleKeys = Record<FlattenKeys<LocaleType>, string>;
