import { bundledLanguagesInfo } from 'shiki';

export function normalizeCodeLanguage(input: string): string | null {
  const language = input.trim().toLocaleLowerCase();
  if (!language) return null;

  const matchLang = bundledLanguagesInfo.find(
    (lang) =>
      lang.id.toLocaleLowerCase() === language ||
      lang.aliases?.some((alias) => alias.toLocaleLowerCase() === language),
  );
  return matchLang?.id || null;
}

export function getCodeLanguageAliases(language: string): string[] {
  const normalized = normalizeCodeLanguage(language);
  if (!normalized) return [];
  const matchLang = bundledLanguagesInfo.find((lang) => lang.id === normalized);
  return [...new Set([normalized, ...(matchLang?.aliases ?? [])])];
}

export function getCodeLanguageByInput(input: string): string {
  return normalizeCodeLanguage(input) || 'plaintext';
}
