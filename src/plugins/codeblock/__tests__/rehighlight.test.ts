import { describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';

import { CodeblockPlugin } from '../plugin';

const staleToken = (text: string, color: string) => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: `color: var(--ant-color-${color});`,
  text,
  type: 'code-highlight',
  version: 1,
});

const document_ = {
  root: {
    children: [
      {
        children: [staleToken('const', 'info'), staleToken(' a = 1', 'text')],
        direction: null,
        format: '',
        indent: 0,
        language: 'typescript',
        theme: 'lobe-theme',
        type: 'code',
        version: 1,
      },
      {
        children: [],
        direction: null,
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

describe('codeblock rehighlight', () => {
  it('replaces stored token styles with the current theme on load', async () => {
    const kernel = Editor.createEditor().registerPlugins([
      CommonPlugin,
      MarkdownPlugin,
      CodeblockPlugin,
    ]);
    kernel.setRootElement(document.createElement('div'));
    kernel.setDocument('json', document_);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const json = kernel.getDocument('json') as unknown as typeof document_;
    const styles = json.root.children[0].children.map((node) => node.style);
    expect(styles.some((style) => style.includes('--ant-'))).toBe(false);
    expect(styles.some((style) => style.includes('--lobe-'))).toBe(true);
  });
});
