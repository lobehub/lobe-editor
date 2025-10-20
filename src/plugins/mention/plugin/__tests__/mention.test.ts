import { beforeEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { IEditor } from '@/types';

import { MentionPlugin } from '..';

describe('Mention Plugin Tests', () => {
  let kernel: IEditor;

  beforeEach(() => {
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin]);
  });

  it('should markdown reader work', () => {
    kernel.registerPlugin(MentionPlugin, {
      decorator: () => {
        return null;
      },
      markdownReader: (node, children) => {
        if (node.value === '<mention>') {
          const text = children
            .map((child) => {
              if (child.type === 'text') {
                // @ts-expect-error not error
                return child.text;
              }
              return '';
            })
            .join('');
          return {
            type: 'mention',
            version: 1,
            label: text.split('[')[0],
            metadata: {
              id: text.split('[')[1]?.replace(']', '') || '',
            },
          };
        }
        return false;
      },
    });

    kernel.setRootElement(document.createElement('div'));
    kernel.setDocument('markdown', '<mention>前端研发专家[bot1]</mention>');
    const { root } = kernel.getDocument('json') as any;

    expect(root.children.length).toBe(1);
    expect(root.children[0].type).toBe('paragraph');
    expect(root.children[0].children.length).toBe(1);

    const mention = root.children[0].children[0];
    expect(mention.type).toBe('mention');
    expect(mention.label).toBe('前端研发专家');
    expect(mention.metadata.id).toBe('bot1');
  });
});
