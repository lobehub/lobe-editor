import { CommonPlugin, Kernel } from '@lobehub/editor';
import { describe, expect, it } from 'vitest';

import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { MathPlugin } from '../plugin';

describe('Math plugin', () => {
  it('should math markdown writer work', () => {
    const editor = new Kernel();
    editor.registerPlugins([MarkdownPlugin, CommonPlugin, MathPlugin]);

    editor.setRootElement(document.createElement('div'));
    editor.setDocument('json', {
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'This is a math test: ',
                type: 'text',
                version: 1,
              },
              {
                type: 'math',
                version: 1,
                code: 'E=mc^2',
              },
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: '\uFEFF',
                type: 'cursor',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
            textStyle: '--shiki-dark:var(--color-text);--shiki-light:var(--color-text)',
            textFormat: 0,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
        textStyle: '--shiki-dark:var(--color-text);--shiki-light:var(--color-text)',
      },
    });

    const markdown = editor.getDocument('markdown');
    expect(markdown).toBe('This is a math test: $E=mc^2$\n');
  });

  it('should math block markdown writer work', () => {
    const editor = new Kernel();
    editor.registerPlugins([MarkdownPlugin, CommonPlugin, MathPlugin]);

    editor.setRootElement(document.createElement('div'));
    editor.setDocument('json', {
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'this is block',
                type: 'text',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
            textFormat: 0,
            textStyle: '',
          },
          {
            type: 'mathBlock',
            version: 1,
            code: 'E=mc^2',
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
        textStyle: '--shiki-dark:var(--color-info);--shiki-light:var(--color-info)',
      },
    });

    const markdown = editor.getDocument('markdown');
    expect(markdown).toBe('this is block\n$$\nE=mc^2\n$$\n');
  });
});
