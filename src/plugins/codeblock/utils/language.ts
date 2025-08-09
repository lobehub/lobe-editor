export const CodeLanguage: Record<string, string> = {
  'atom': 'atom',
  'c': 'c',
  'c++': 'cpp',
  'clike': 'clike',
  'cpp': 'cpp',
  'css': 'css',
  'diff': 'diff',
  'html': 'html',
  'java': 'java',
  'javascript': 'javascript',
  'js': 'js',
  'markdown': 'markdown',
  'markup': 'markup',
  'mathml': 'mathml',
  'md': 'md',
  'objc': 'objc',
  'objectivec': 'objectivec',
  'plain': 'plain',
  'plaintext': 'plaintext',
  'powershell': 'powershell',
  'py': 'py',
  'python': 'python',
  'rss': 'rss',
  'rust': 'rust',
  'sql': 'sql',
  'ssml': 'ssml',
  'svg': 'svg',
  'swift': 'swift',
  'text': 'text',
  'ts': 'ts',
  'txt': 'txt',
  'typescript': 'typescript',
  'xml': 'xml',
};

export function getCodeLanguageByInput(input: string): string {
  if (!input) {
    return 'plaintext';
  }
  return CodeLanguage[input.toLocaleLowerCase()] || 'plaintext';
}
