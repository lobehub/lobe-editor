import { describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

import { CodemirrorPlugin } from '../plugin';

describe('codemirror-block litexml', () => {
  let editor: IEditor;

  beforeEach(() => {
    editor = Editor.createEditor();
    editor.registerPlugins([
      LitexmlPlugin,
      MarkdownPlugin,
      CommonPlugin,
      [
        CodemirrorPlugin,
        {
          decorator: () => null,
        },
      ],
    ]);
    editor.initNodeEditor();
  });

  it('reader should work - convert litexml to markdown', () => {
    editor.setDocument(
      'litexml',
      '<code lang="javascript">console.log("hello");\nconsole.log("world");</code>',
    );
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toContain('```');
    expect(markdown).toContain('console.log("hello");');
    expect(markdown).toContain('console.log("world");');
  });

  it('writer should work - convert markdown to litexml', () => {
    editor.setDocument(
      'markdown',
      '```javascript\nconsole.log("hello");\nconsole.log("world");\n```',
    );
    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml).toContain('<code');
    expect(xml).toContain('lang="javascript"');
    expect(xml).toContain('console.log("hello");');
    expect(xml).toContain('console.log("world");');
  });

  it('should handle plain text code blocks', () => {
    editor.setDocument('litexml', '<code lang="plain">simple text\ncode block</code>');
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toContain('```');
    expect(markdown).toContain('simple text');
    expect(markdown).toContain('code block');
  });

  it('should preserve code content with special characters', () => {
    const specialCode = 'const arr = [1, 2, 3];\nconst obj = { key: "value" };';
    editor.setDocument('litexml', `<code lang="typescript">${specialCode}</code>`);
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toContain(specialCode);
  });
});
