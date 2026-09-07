/**
 * @vitest-environment happy-dom
 */
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadCodeMirror: vi.fn(),
  useLexicalNodeSelection: vi.fn(),
}));

vi.mock('@lexical/utils', () => ({
  mergeRegister:
    (...cleanups: Array<() => void>) =>
    () =>
      cleanups.forEach((cleanup) => cleanup()),
}));

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
    createElement('button', props, children),
  Block: ({ children, variant: _variant, ...props }: { children?: ReactNode; variant?: unknown }) =>
    createElement('div', props, children),
}));

vi.mock('lexical', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lexical')>();
  return {
    ...actual,
    $getSelection: vi.fn(() => null),
    $setSelection: vi.fn(),
  };
});

vi.mock('@/codemirror', () => ({
  lobeTheme: {},
  styles: 'codemirror-block',
  Toolbar: ({ children, selectedLang }: { children?: ReactNode; selectedLang?: string }) =>
    createElement(
      'div',
      { 'data-testid': 'codemirror-toolbar', 'data-language': selectedLang },
      children,
    ),
}));

vi.mock('@/editor-kernel/react/useLexicalNodeSelection', () => ({
  useLexicalNodeSelection: mocks.useLexicalNodeSelection,
}));

vi.mock('@/editor-kernel/react/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('../lib', () => ({ loadCodeMirror: mocks.loadCodeMirror }));

vi.mock('./useCodemirrorEditLock', () => ({
  useCodemirrorEditLock: () => ({
    acquireLock: () => true,
    isLockedByRemote: false,
    lockOwnerName: null,
    releaseLock: vi.fn(),
  }),
}));

import type { CodeMirrorNode } from '../node/CodeMirrorNode';
import ReactCodemirrorNode from './CodemirrorNode';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const createNode = (code: string, lang = 'javascript'): CodeMirrorNode =>
  ({
    code,
    getKey: () => 'codemirror-node-1',
    getPreviousSibling: () => null,
    lang,
    options: { indentWithTabs: false, lineNumbers: false, tabSize: 2 },
    setCode: vi.fn(),
    setIndentWithTabs: vi.fn(),
    setLang: vi.fn(),
    setLineNumbers: vi.fn(),
    setTabSize: vi.fn(),
  }) as unknown as CodeMirrorNode;

const createEditor = () =>
  ({
    dispatchCommand: vi.fn(),
    focus: vi.fn(),
    getEditorState: () => ({ read: (callback: () => unknown) => callback() }),
    registerCommand: vi.fn(() => vi.fn()),
    update: vi.fn(),
  }) as never;

describe('ReactCodemirrorNode', () => {
  beforeEach(() => {
    mocks.useLexicalNodeSelection.mockReset().mockReturnValue([false, vi.fn(), vi.fn(), false]);
    mocks.loadCodeMirror.mockReset();
  });

  it('mirrors an externally rewritten CodeMirrorNode into the live CodeMirror document', async () => {
    let value = 'const oldValue = 1;';
    const instance = {
      blur: vi.fn(),
      destroy: vi.fn(),
      focus: vi.fn(),
      getValue: vi.fn(() => value),
      on: vi.fn(),
      optionHelper: { theme: { reconfigure: vi.fn() } },
      setOption: vi.fn(),
      setSelectionToEnd: vi.fn(),
      setValue: vi.fn((nextValue: string) => {
        value = nextValue;
      }),
      view: {
        constructor: { theme: vi.fn(() => ({})) },
        dispatch: vi.fn(),
        hasFocus: false,
      },
    };
    mocks.loadCodeMirror.mockResolvedValue({
      fromTextArea: vi.fn(() => instance),
    });
    const editor = createEditor();
    const firstNode = createNode(value);
    const host = document.createElement('div');
    document.body.append(host);
    const view = createRoot(host);
    await act(async () => {
      view.render(
        createElement(ReactCodemirrorNode, {
          editor,
          node: firstNode,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(instance.setValue).not.toHaveBeenCalled();
    const rewritten = 'function quickSort(items) { return items; }';
    await act(async () => {
      view.render(
        createElement(ReactCodemirrorNode, {
          editor,
          node: createNode(rewritten, 'python'),
        }),
      );
      await Promise.resolve();
    });

    expect(instance.getValue()).toBe(rewritten);
    expect(instance.setValue).toHaveBeenCalledWith(rewritten);
    expect(instance.setOption).toHaveBeenCalledWith('mode', 'python');
    instance.setValue.mockClear();
    for (const language of ['plain', 'javascript', 'rust']) {
      await act(async () => {
        view.render(
          createElement(ReactCodemirrorNode, { editor, node: createNode(rewritten, language) }),
        );
      });
      expect(instance.setOption).toHaveBeenCalledWith('mode', language);
      expect(
        host.querySelector('[data-testid="codemirror-toolbar"]')?.getAttribute('data-language'),
      ).toBe(language);
      expect(instance.getValue()).toBe(rewritten);
      expect(instance.setValue).not.toHaveBeenCalled();
    }
    await act(async () => view.unmount());
    host.remove();
  });
});
