import { bundledLanguagesInfo } from 'shiki';

export function getCodeLanguageByInput(input: string): string {
  if (!input) {
    return 'plaintext';
  }
  const inputLang = input.toLocaleLowerCase();

  const matchLang = bundledLanguagesInfo.find(
    (lang) => lang.id === inputLang || lang.aliases?.includes(inputLang),
  );
  return matchLang?.id || 'plaintext';
}
