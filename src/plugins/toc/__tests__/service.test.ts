import type { LexicalEditor } from 'lexical';
import { describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';

import { TocPlugin } from '../plugin';
import { ITocService, TocService } from '../service';

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('TocService', () => {
  it('notifies subscribers when active heading changes', () => {
    const service = new TocService();
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);

    service.setActiveKey('heading-a');
    service.setActiveKey('heading-a');
    service.setActiveKey('heading-b');
    unsubscribe();
    service.setActiveKey('heading-c');

    expect(listener).toHaveBeenCalledTimes(2);
    expect(service.getActiveKey()).toBe('heading-c');
  });

  it('scrolls the viewport to a heading through the bound lexical editor', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const service = new TocService();
    const editor = {
      getElementByKey: (key: string) =>
        key === 'heading-a'
          ? {
              getBoundingClientRect: () => ({ top: 120 }),
              scrollIntoView: vi.fn(),
            }
          : null,
    } as unknown as LexicalEditor;

    service.bindEditor(editor);

    expect(service.jumpTo('missing')).toBe(false);
    expect(service.jumpTo('heading-a', { behavior: 'auto', offsetTop: 16 })).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'auto', top: 104 });
    expect(service.getActiveKey()).toBe('heading-a');
  });

  it('refreshes toc items when document headings change', async () => {
    const kernel = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, TocPlugin]);
    kernel.initNodeEditor();

    const service = kernel.requireService(ITocService);
    expect(service).not.toBeNull();

    kernel.setDocument('markdown', '# Intro\n\n## Details\n\nBody');
    await nextTick();

    expect(service?.getFlatItems().map((item) => item.title)).toEqual(['Intro', 'Details']);

    const json = kernel.getDocument('json') as any;
    json.root.children[0].children[0].text = 'Updated intro';
    json.root.children.splice(1, 1);
    json.root.children.push({
      children: [
        {
          detail: 0,
          format: 0,
          mode: 'normal',
          style: '',
          text: 'New section',
          type: 'text',
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      tag: 'h2',
      type: 'heading',
      version: 1,
    });

    kernel.setDocument('json', json);
    await nextTick();

    expect(service?.getFlatItems().map((item) => item.title)).toEqual([
      'Updated intro',
      'New section',
    ]);
  });
});
