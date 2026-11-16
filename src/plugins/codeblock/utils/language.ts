import { codeLanguages } from './languages';

export function normalizeCodeLanguage(input: string): string | null {
  const normalized = input.trim().toLocaleLowerCase();
  if (!normalized) return null;

  const match = codeLanguages.find(
    (language) =>
      language.id.toLocaleLowerCase() === normalized ||
      language.aliases?.some((alias) => alias.toLocaleLowerCase() === normalized),
  );

  return match?.id || null;
}

export function getCodeLanguageAliases(language: string): string[] {
  const normalized = normalizeCodeLanguage(language);
  if (!normalized) return [];

  const match = codeLanguages.find((item) => item.id.toLocaleLowerCase() === normalized);
  return [...new Set([normalized, ...(match?.aliases ?? [])])];
}

export function getCodeLanguageByInput(input: string): string {
  return normalizeCodeLanguage(input) || 'plaintext';
}
