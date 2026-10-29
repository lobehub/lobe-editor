import type { EditorConfig } from 'lexical';
import { $getRoot, $isElementNode, type LexicalNode } from 'lexical';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { ListPlugin } from '@/plugins/list/plugin';

import { getKernelFromEditorConfig } from '../utils';

const getKernelFor = (editor: ReturnType<typeof Editor.createEditor>) =>
  getKernelFromEditorConfig({ theme: editor.getTheme() } as EditorConfig);

describe('editor root lifecycle', () => {
  const kernels: Array<ReturnType<typeof Editor.createEditor>> = [];

  afterEach(() => {
    kernels.splice(0).forEach((kernel) => kernel.destroy());
  });

  it('releases and restores the EditorMap and dragon listener around root detach', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const kernel = Editor.createEditor().registerPlugins([CommonPlugin]);
    kernels.push(kernel);

    const firstRoot = document.createElement('div');
    const secondRoot = document.createElement('div');
    const lexicalEditor = kernel.setRootElement(firstRoot);

    expect(getKernelFor(kernel)).toBe(kernel);
    expect(addEventListener.mock.calls.filter(([type]) => type === 'message')).toHaveLength(1);

    kernel.setRootElement(null);

    expect(kernel.getRootElement()).toBeNull();
    expect(getKernelFor(kernel)).toBeNull();
    expect(removeEventListener.mock.calls.filter(([type]) => type === 'message')).toHaveLength(1);

    kernel.setRootElement(secondRoot);

    expect(kernel.getLexicalEditor()).toBe(lexicalEditor);
    expect(kernel.getRootElement()).toBe(secondRoot);
    expect(getKernelFor(kernel)).toBe(kernel);
    expect(addEventListener.mock.calls.filter(([type]) => type === 'message')).toHaveLength(2);

    kernel.setRootElement(null);
    expect(removeEventListener.mock.calls.filter(([type]) => type === 'message')).toHaveLength(2);

    addEventListener.mockRestore();
    removeEventListener.mockRestore();
  });

  it('tracks direct Lexical root changes and supports destroy followed by re-init', () => {
    const kernel = Editor.createEditor().registerPlugins([CommonPlugin]);
    kernels.push(kernel);
    const firstRoot = document.createElement('div');
    const secondRoot = document.createElement('div');
    const firstLexicalEditor = kernel.setRootElement(firstRoot);

    firstLexicalEditor.setRootElement(null);
    expect(getKernelFor(kernel)).toBeNull();

    firstLexicalEditor.setRootElement(secondRoot);
    expect(getKernelFor(kernel)).toBe(kernel);
    expect(kernel.getLexicalEditor()).toBe(firstLexicalEditor);

    kernel.destroy();

    expect(kernel.getLexicalEditor()).toBeNull();
    expect(getKernelFor(kernel)).toBeNull();

    const reinitializedEditor = kernel.setRootElement(document.createElement('div'));
    expect(reinitializedEditor).not.toBe(firstLexicalEditor);
    expect(kernel.getRootElement()).toBe(reinitializedEditor.getRootElement());
    expect(kernel.getLexicalEditor()).toBe(reinitializedEditor);
    expect(getKernelFor(kernel)).toBe(kernel);

    kernel.setDocument('text', 'reinitialized');
    expect(kernel.getDocument('text')).toBe('reinitialized');
  });

  it('flushes plugin setup for an unattached node editor before loading content', () => {
    const kernel = Editor.createEditor().registerPlugins([CommonPlugin]);
    kernels.push(kernel);

    const lexicalEditor = kernel.initNodeEditor()!;
    expect(lexicalEditor.getRootElement()).toBeNull();
    kernel.setDocument('text', 'node editor read works');
    expect(kernel.getDocument('text')).toBe('node editor read works');
  });

  it('does not attach dragon support for headless editors', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const kernel = Editor.createEditor().registerPlugins([CommonPlugin]);
    kernels.push(kernel);

    kernel.initHeadlessEditor();
    kernel.setDocument('text', 'headless read works');
    expect(kernel.getDocument('text')).toBe('headless read works');

    expect(addEventListener.mock.calls.filter(([type]) => type === 'message')).toHaveLength(0);

    kernel.destroy();

    expect(removeEventListener.mock.calls.filter(([type]) => type === 'message')).toHaveLength(0);
    addEventListener.mockRestore();
    removeEventListener.mockRestore();
  });

  it('loads adjacent deep lists immediately after DOM initialization with a consistent tree', () => {
    const kernel = Editor.createEditor().registerPlugins([CommonPlugin, LitexmlPlugin, ListPlugin]);
    kernels.push(kernel);
    kernel.setRootElement(document.createElement('div'));

    const nestedList = (text: string, id: string) => {
      let content = `<span>${text}</span>`;
      for (let level = 0; level < 12; level++) {
        content = `<ul><li>Level ${level}</li><li>${content}</li></ul>`;
      }
      return content.replace('<ul>', `<ul id="${id}">`);
    };
    kernel.setDocument(
      'litexml',
      `<root>${nestedList('A &quot;quoted&quot; \\ value', 'nested-a')}${nestedList('B &quot;quoted&quot; \\ value', 'nested-b')}</root>`,
    );

    const lexicalEditor = kernel.getLexicalEditor()!;
    lexicalEditor.getEditorState().read(
      () => {
        const root = $getRoot();
        const visit = (node: LexicalNode) => {
          if (!$isElementNode(node)) return;
          const children = node.getChildren();
          expect(children).toHaveLength(node.getChildrenSize());
          children.forEach(visit);
        };

        visit(root);
        expect(root.getTextContent()).toContain('A "quoted" \\ value');
        expect(root.getTextContent()).toContain('B "quoted" \\ value');
      },
      { editor: lexicalEditor },
    );
    expect(kernel.getRootElement()?.textContent).toContain('A "quoted" \\ value');
    expect(kernel.getRootElement()?.textContent).toContain('B "quoted" \\ value');
  });
});
