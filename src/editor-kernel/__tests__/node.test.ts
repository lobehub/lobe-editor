// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { CodePlugin } from '@/plugins/code';
import { CodeblockPlugin } from '@/plugins/codeblock';
import { CommonPlugin } from '@/plugins/common';
import { FilePlugin } from '@/plugins/file';
import { HRPlugin } from '@/plugins/hr';
import { ImagePlugin } from '@/plugins/image';
import { LinkPlugin } from '@/plugins/link';
import { LinkHighlightPlugin } from '@/plugins/link-highlight';
import { ListPlugin } from '@/plugins/list';
import { MarkdownPlugin } from '@/plugins/markdown';
import { MathPlugin } from '@/plugins/math';
import { MentionPlugin } from '@/plugins/mention';
import { SlashPlugin } from '@/plugins/slash';
import { TablePlugin } from '@/plugins/table';

import Editor from '../';

describe('node kernel test', () => {
  it('should initialize node editor', () => {
    const editor = Editor.createEditor().registerPlugins([
      CodePlugin,
      CodeblockPlugin,
      CommonPlugin,
      FilePlugin,
      HRPlugin,
      ImagePlugin,
      LinkPlugin,
      LinkHighlightPlugin,
      ListPlugin,
      MarkdownPlugin,
      MathPlugin,
      MentionPlugin,
      TablePlugin,
    ]);
    editor.initNodeEditor();

    editor.setDocument(
      'markdown',
      '# Hello World\nThis is a **test** markdown document.\n- Item 1\n- Item 2\n',
    );

    const json = editor.getDocument('json') as any;
    const root = json.root;
    expect(json).toBeDefined();
    expect(root.children.length).toBe(3);
    expect(root.children[0].type).toBe('heading');
    expect(root.children[1].type).toBe('paragraph');
    expect(root.children[2].type).toBe('list');

    const heading = root.children[0];
    expect(heading.children.length).toBe(1);
    expect(heading.children[0].type).toBe('text');
    expect(heading.children[0].text).toBe('Hello World');

    heading.children[0].text = 'Modified Heading';

    editor.setDocument('json', json);
    const updatedMarkdown = editor.getDocument('markdown') as unknown as string;
    expect(updatedMarkdown).toContain('Modified Heading');
  });
});
