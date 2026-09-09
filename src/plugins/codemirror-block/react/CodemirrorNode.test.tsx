/**
 * @vitest-environment happy-dom
 */
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $getRoot, $nodesOfType } from 'lexical';

import KernelEditor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { ENTER_HOLE_CONTENT_COMMAND } from '@/plugins/common/command';
import { HoleNode } from '@/plugins/common/node/hole';
import { CodemirrorPlugin } from '../plugin';

const mocks = vi.hoisted(() => ({
  loadCodeMirror: vi.fn(),
  useLexicalNodeSelection: vi.fn(),
}));
const lexicalSelectionMock = vi.hoisted(() => ({
  getSelection: vi.fn(() => null),
  setSelection: vi.fn(),
}));

vi.mock('@lexical/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@lexical/utils')>();
  return {
    ...actual,
    mergeRegister:
      (...cleanups: Array<() => void>) =>
      () =>
        cleanups.forEach((cleanup) => cleanup()),
  };
});

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
    $getSelection: lexicalSelectionMock.getSelection,
    $setSelection: lexicalSelectionMock.setSelection,
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

import { $createCodeMirrorNode, type CodeMirrorNode } from '../node/CodeMirrorNode';
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

const createEditor = (handlers?: Map<unknown, (payload: any) => boolean>) =>
  ({
    dispatchCommand: vi.fn(),
    focus: vi.fn(),
    getEditorState: () => ({ read: (callback: () => unknown) => callback() }),
    isEditable: () => true,
    registerCommand: vi.fn((command: unknown, handler: unknown) => {
      if (handlers && typeof handler === 'function') {
        handlers.set(command, handler as (payload: any) => boolean);
      }
      return vi.fn();
    }),
    update: vi.fn(),
  }) as never;

describe('ReactCodemirrorNode', () => {
  beforeEach(() => {
    mocks.useLexicalNodeSelection.mockReset().mockReturnValue([false, vi.fn(), vi.fn(), false]);
    mocks.loadCodeMirror.mockReset();
    lexicalSelectionMock.getSelection.mockReset().mockReturnValue(null);
    lexicalSelectionMock.setSelection.mockReset();
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

  it('accepts both Hole entry directions without letting focus reselect the outer node', async () => {
    let focusHandler: (() => void) | undefined;
    const setSelected = vi.fn();
    mocks.useLexicalNodeSelection.mockReturnValue([false, setSelected, vi.fn(), false]);

    const instance = {
      blur: vi.fn(),
      destroy: vi.fn(),
      focus: vi.fn(() => focusHandler?.()),
      getValue: vi.fn(() => 'const answer = 42;'),
      on: vi.fn((event: string, handler: unknown) => {
        if (event === 'focus') focusHandler = handler as () => void;
      }),
      optionHelper: { theme: { reconfigure: vi.fn() } },
      setOption: vi.fn(),
      setSelectionToEnd: vi.fn(),
      setSelectionToStart: vi.fn(),
      setValue: vi.fn(),
      view: {
        constructor: { theme: vi.fn(() => ({})) },
        dispatch: vi.fn(),
        hasFocus: false,
      },
    };
    mocks.loadCodeMirror.mockResolvedValue({
      fromTextArea: vi.fn(() => instance),
    });

    const handlers = new Map<unknown, (payload: any) => boolean>();
    const editor = createEditor(handlers);
    const host = document.createElement('div');
    document.body.append(host);
    const view = createRoot(host);
    await act(async () => {
      view.render(
        createElement(ReactCodemirrorNode, { editor, node: createNode('const answer = 42;') }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const enter = handlers.get(ENTER_HOLE_CONTENT_COMMAND);
    if (!enter || !focusHandler) throw new Error('CodeMirror entry handler missing');
    lexicalSelectionMock.getSelection.mockReturnValue({ getNodes: () => [] } as never);

    expect(enter({ from: 'before', key: 'other-codemirror-node' })).toBe(false);
    expect(instance.focus).not.toHaveBeenCalled();
    expect(lexicalSelectionMock.setSelection).not.toHaveBeenCalled();

    expect(enter({ from: 'before', key: 'codemirror-node-1' })).toBe(true);
    expect(instance.focus).toHaveBeenCalledOnce();
    expect(instance.setSelectionToStart).toHaveBeenCalledOnce();
    expect(instance.setSelectionToEnd).not.toHaveBeenCalled();
    expect(lexicalSelectionMock.setSelection).toHaveBeenCalledWith(null);
    expect(setSelected).not.toHaveBeenCalled();

    await Promise.resolve();
    expect(enter({ from: 'after', key: 'codemirror-node-1' })).toBe(true);
    expect(instance.focus).toHaveBeenCalledTimes(2);
    expect(instance.setSelectionToEnd).toHaveBeenCalledOnce();
    expect(setSelected).not.toHaveBeenCalled();

    await act(async () => view.unmount());
    host.remove();
  });

  it('removes a sole empty CodeMirror Hole and leaves a usable paragraph selection', async () => {
    let keydownHandler: ((event: KeyboardEvent) => void) | undefined;
    const instance = {
      blur: vi.fn(),
      destroy: vi.fn(),
      focus: vi.fn(),
      getValue: vi.fn(() => ''),
      on: vi.fn((event: string, handler: (instance: unknown, event: KeyboardEvent) => void) => {
        if (event === 'keydown')
          keydownHandler = (keyboardEvent) => handler(instance, keyboardEvent);
      }),
      optionHelper: { theme: { reconfigure: vi.fn() } },
      setOption: vi.fn(),
      setSelectionToEnd: vi.fn(),
      setValue: vi.fn(),
      view: {
        constructor: { theme: vi.fn(() => ({})) },
        dispatch: vi.fn(),
        hasFocus: false,
      },
    };
    mocks.loadCodeMirror.mockResolvedValue({
      fromTextArea: vi.fn(() => instance),
    });

    const kernel = KernelEditor.createEditor().registerPlugins([CommonPlugin, CodemirrorPlugin]);
    kernel.initHeadlessEditor();
    const lexical = kernel.getLexicalEditor()!;
    const editor = {
      dispatchCommand: lexical.dispatchCommand.bind(lexical),
      focus: vi.fn(),
      getEditorState: lexical.getEditorState.bind(lexical),
      registerCommand: lexical.registerCommand.bind(lexical),
      update: lexical.update.bind(lexical),
    } as unknown as typeof lexical;
    lexical.update(() => {
      $getRoot().append(
        // CodeMirrorPlugin's node transform supplies the runtime Hole wrapper.
        // The component receives the actual payload node below after the update.
        $createCodeMirrorNode('', ''),
      );
    });
    await moment();

    const node = lexical
      .getEditorState()
      .read(() => $nodesOfType(HoleNode)[0]?.getContentChildren()[0]);
    if (!node) throw new Error('CodeMirror Hole payload missing');
    const host = document.createElement('div');
    document.body.append(host);
    const view = createRoot(host);
    await act(async () => {
      view.render(
        createElement(ReactCodemirrorNode, {
          editor,
          node: node as CodeMirrorNode,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    if (!keydownHandler) throw new Error('CodeMirror keydown handler missing');
    const event = {
      key: 'Backspace',
      keyCode: 8,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    await act(async () => {
      keydownHandler?.(event);
      await Promise.resolve();
    });

    expect(event.preventDefault).toHaveBeenCalledOnce();
    lexical.getEditorState().read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((child) => child.getType()),
      ).toEqual(['paragraph']);
      expect($nodesOfType(HoleNode)).toHaveLength(0);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const lexicalActual = await vi.importActual<typeof import('lexical')>('lexical');
    let paragraphKey = '';
    lexical.getEditorState().read(() => {
      const selection = lexicalActual.$getSelection();
      if (!lexicalActual.$isRangeSelection(selection)) {
        throw new Error('Backspace fallback selection missing');
      }
      const anchorNode = selection.anchor.getNode();
      paragraphKey = anchorNode.getKey();
      expect(anchorNode.getType()).toBe('paragraph');
      expect(anchorNode.isAttached()).toBe(true);
    });
    lexical.update(() => {
      const selection = lexicalActual.$getSelection();
      if (!lexicalActual.$isRangeSelection(selection)) {
        throw new Error('Backspace fallback selection is not editable');
      }
      selection.insertText('after delete');
    });
    await moment();
    lexical.getEditorState().read(() => {
      expect(lexicalActual.$getNodeByKey(paragraphKey)?.getTextContent()).toBe('after delete');
    });

    await act(async () => view.unmount());
    host.remove();
    kernel.destroy();
  });
});
