import { act } from 'react';
import type { DependencyList, ReactNode } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CREATE_ANNOTATION_COMMAND, OPEN_ANNOTATION_COMPOSER_COMMAND } from '../../command';
import { AnnotationToolbarAction } from '../AnnotationToolbarAction';
import ReactNodePropertiesPlugin from '../ReactNodePropertiesPlugin';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => {
  const commandHandlers = new Map<any, (payload: any) => boolean>();
  const anchor = document.createElement('span');
  const editorRoot = document.createElement('div');
  editorRoot.append(anchor);
  const range = {
    getBoundingClientRect: () => new DOMRect(100, 120, 40, 20),
  };
  const domSelection = {
    anchorNode: anchor,
    getRangeAt: () => range,
    isCollapsed: false,
    rangeCount: 1,
  };
  const selection = {
    anchor: { key: 'text-1' },
    focus: { key: 'text-1' },
    clone: () => selection,
    getNodes: () => [{ getKey: () => 'text-1' }],
    getTextContent: () => 'selected text',
  };
  const updateListeners = new Set<() => void>();
  const lexicalEditor = {
    _window: window,
    registerRootListener: vi.fn((listener: (root: HTMLElement | null) => void) => {
      listener(editorRoot);
      return () => undefined;
    }),
    registerUpdateListener: vi.fn((listener: () => void) => {
      updateListeners.add(listener);
      return () => updateListeners.delete(listener);
    }),
    getEditorState: () => ({ read: (callback: () => void) => callback() }),
    getElementByKey: (key: string) => (key === 'text-1' ? anchor : null),
    getRootElement: () => editorRoot,
    isEditable: () => true,
    read: vi.fn((callback: () => void) => callback()),
    registerCommand: vi.fn((command, listener) => {
      commandHandlers.set(command, listener);
      return () => commandHandlers.delete(command);
    }),
  };
  const kernelEditor = {
    dispatchCommand: vi.fn((command, payload) => commandHandlers.get(command)?.(payload) ?? false),
    getLexicalEditor: () => lexicalEditor,
    isEditable: () => true,
    registerPlugin: vi.fn(),
    requireService: vi.fn(() => null),
  };

  return {
    anchor,
    commandHandlers,
    domSelection,
    editorRoot,
    kernelEditor,
    lexicalEditor,
    selection,
    updateListeners,
  };
});

vi.mock('lexical', async () => {
  const actual = await vi.importActual<typeof import('lexical')>('lexical');
  return {
    ...actual,
    $getNearestNodeFromDOMNode: vi.fn(() => ({ getKey: () => 'text-1' })),
    $getSelection: vi.fn(() => mocks.selection),
    getDOMSelection: vi.fn(() => mocks.domSelection),
  };
});

vi.mock('@/editor-kernel/react', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    useLexicalComposerContext: () => [mocks.kernelEditor],
    useLexicalEditor: (
      handleEditor: (editor: typeof mocks.lexicalEditor) => (() => void) | undefined,
      deps: DependencyList = [],
    ) => {
      React.useEffect(() => handleEditor(mocks.lexicalEditor), deps);
    },
  };
});

describe('ReactNodePropertiesPlugin', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host, mocks.editorRoot);
    root = createRoot(host);
    mocks.commandHandlers.clear();
    mocks.updateListeners.clear();
    mocks.domSelection.rangeCount = 1;
    delete mocks.anchor.dataset.annotationIds;
    mocks.lexicalEditor.registerCommand.mockClear();
    mocks.kernelEditor.dispatchCommand.mockClear();
    mocks.kernelEditor.registerPlugin.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    mocks.editorRoot.remove();
  });

  it('does not render or open a composer in read-only mode', async () => {
    await act(async () => {
      root.render(
        <ReactNodePropertiesPlugin readOnly renderComposer={() => <div data-testid="composer" />}>
          <button type="button">Comment</button>
        </ReactNodePropertiesPlugin>,
      );
    });

    expect(host.querySelector('button')).toBeNull();
    expect(host.querySelector('style')?.textContent).toContain('text-decoration-line: underline');
    await act(async () => {
      mocks.commandHandlers.get(OPEN_ANNOTATION_COMPOSER_COMMAND)?.({ kind: 'comment' });
    });
    expect(document.querySelector('[data-testid="composer"]')).toBeNull();
  });

  it('opens a positioned composer from AnnotationToolbarAction with selection rect context', async () => {
    const renderComposer = vi.fn((context: { close: () => void; rect: DOMRect | null }) => (
      <div data-testid="composer" data-left={String(context.rect?.left)}>
        <button type="button" onClick={context.close}>
          Close
        </button>
      </div>
    ));

    await act(async () => {
      root.render(
        <ReactNodePropertiesPlugin renderComposer={renderComposer}>
          <AnnotationToolbarAction>Comment</AnnotationToolbarAction>
        </ReactNodePropertiesPlugin>,
      );
    });

    const toolbarButton = host.querySelector('button');
    expect(toolbarButton).not.toBeNull();
    await act(async () => {
      toolbarButton?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      toolbarButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const composer = document.querySelector('[data-testid="composer"]');
    expect(composer).not.toBeNull();
    expect(composer?.getAttribute('data-left')).toBe('100');
    expect(document.querySelector('[data-annotation-composer="true"]')).not.toBeNull();
    expect(renderComposer).toHaveBeenCalledWith(
      expect.objectContaining({ quotedText: 'selected text', rect: expect.any(DOMRect) }),
    );
  });

  it('hands the composer context to an external owner and closes it without a body portal', async () => {
    const onComposerChange = vi.fn();

    await act(async () => {
      root.render(
        <ReactNodePropertiesPlugin onComposerChange={onComposerChange}>
          <span />
        </ReactNodePropertiesPlugin>,
      );
    });

    await act(async () => {
      mocks.kernelEditor.dispatchCommand(OPEN_ANNOTATION_COMPOSER_COMMAND, {
        kind: 'comment',
        nodeKeys: ['block-1'],
        quotedText: 'Whole block',
      });
    });

    const context = onComposerChange.mock.calls.at(-1)?.[0];
    expect(context).toEqual(
      expect.objectContaining({ nodeKeys: ['block-1'], quotedText: 'Whole block' }),
    );
    expect(document.querySelector('[data-annotation-composer="true"]')).toBeNull();

    await act(async () => context?.close());
    expect(onComposerChange).toHaveBeenLastCalledWith(null);
  });

  it('exposes saved selection anchor keys when the native range is unavailable', async () => {
    const onComposerChange = vi.fn();
    const getBoundingClientRect = vi
      .spyOn(mocks.anchor, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(80, 320, 160, 24));
    mocks.domSelection.rangeCount = 0;

    await act(async () => {
      root.render(<ReactNodePropertiesPlugin onComposerChange={onComposerChange} />);
    });
    await act(async () => {
      mocks.kernelEditor.dispatchCommand(OPEN_ANNOTATION_COMPOSER_COMMAND, {
        kind: 'comment',
        payload: null,
      });
    });

    const context = onComposerChange.mock.calls.at(-1)?.[0];
    expect(context).toEqual(
      expect.objectContaining({
        anchorNodeKeys: ['text-1'],
        nodeKeys: undefined,
        rect: expect.objectContaining({ top: 320 }),
      }),
    );

    await act(async () => context?.submit({ kind: 'comment', payload: { text: 'range review' } }));
    expect(mocks.kernelEditor.dispatchCommand).toHaveBeenCalledWith(
      CREATE_ANNOTATION_COMMAND,
      expect.objectContaining({
        nodeKeys: undefined,
        selection: mocks.selection,
      }),
    );
    getBoundingClientRect.mockRestore();
  });

  it('renders a legacy composer into the supplied external host', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    await act(async () => {
      root.render(
        <ReactNodePropertiesPlugin
          composerContainer={container}
          renderComposer={() => <div data-testid="external-composer" />}
        />,
      );
    });
    await act(async () => {
      mocks.kernelEditor.dispatchCommand(OPEN_ANNOTATION_COMPOSER_COMMAND, { kind: 'comment' });
    });

    expect(container.querySelector('[data-testid="external-composer"]')).not.toBeNull();
    expect(container.querySelector('[data-annotation-composer="true"]')).not.toBeNull();
    expect(
      container.querySelector('[data-annotation-composer="true"]')?.getAttribute('style'),
    ).toBe(null);
    container.remove();
  });

  it('keeps range underline and block outline styles distinct', async () => {
    await act(async () => {
      root.render(<ReactNodePropertiesPlugin />);
    });

    const css = host.querySelector('style')?.textContent ?? '';
    expect(css).toContain('[data-annotation-scope="range"]');
    expect(css).toContain('text-decoration-style: dotted');
    expect(css).toContain('[data-annotation-scope="block"]');
    expect(css).toContain('outline: 2px solid');
    expect(css).toContain('[data-annotation-scope="range"][data-annotation-active="true"]');
    expect(css).toContain('text-decoration-thickness: 3px');
    expect(css).toContain('[data-annotation-scope="block"][data-annotation-active="true"]');
    expect(css).toContain('box-shadow: 0 0 0 4px');
  });

  it('syncs active annotation ids on the current root and clears stale state', async () => {
    const second = document.createElement('span');
    second.dataset.annotationIds = 'comment-2';
    second.dataset.annotationScope = 'range';
    mocks.anchor.dataset.annotationIds = 'comment-1';
    mocks.anchor.dataset.annotationScope = 'range';

    const outsideRoot = document.createElement('div');
    const outside = document.createElement('span');
    outside.dataset.annotationIds = 'comment-1';
    outside.dataset.annotationActive = 'true';
    outsideRoot.append(outside);
    document.body.append(outsideRoot);
    mocks.editorRoot.append(second);

    await act(async () => {
      root.render(<ReactNodePropertiesPlugin activeAnnotationIds={['comment-1']} />);
    });

    expect(mocks.anchor.dataset.annotationActive).toBe('true');
    expect(second.dataset.annotationActive).toBeUndefined();
    expect(outside.dataset.annotationActive).toBe('true');

    await act(async () => {
      root.render(<ReactNodePropertiesPlugin activeAnnotationIds={['comment-2']} />);
    });
    expect(mocks.anchor.dataset.annotationActive).toBeUndefined();
    expect(second.dataset.annotationActive).toBe('true');
    expect(outside.dataset.annotationActive).toBe('true');

    const rebuilt = document.createElement('span');
    rebuilt.dataset.annotationIds = 'comment-2';
    rebuilt.dataset.annotationScope = 'range';
    await act(async () => {
      mocks.editorRoot.append(rebuilt);
      await Promise.resolve();
    });
    expect(rebuilt.dataset.annotationActive).toBe('true');

    const block = document.createElement('div');
    block.dataset.blockId = 'artifact-1';
    block.dataset.annotationIds = 'comment-2';
    block.dataset.annotationScope = 'block';
    await act(async () => {
      mocks.editorRoot.append(block);
      await Promise.resolve();
    });
    expect(block.dataset.annotationActive).toBe('true');

    await act(async () => {
      root.render(<ReactNodePropertiesPlugin activeAnnotationIds={[]} />);
    });
    expect(block.dataset.annotationActive).toBeUndefined();
    expect(rebuilt.dataset.annotationActive).toBeUndefined();

    outsideRoot.remove();
    second.remove();
    rebuilt.remove();
    block.remove();
  });

  it('opens an annotation bubble from the DOM without losing the active Lexical editor', async () => {
    const annotation = {
      createdAt: '2024-01-01T00:00:00.000Z',
      id: 'comment-1',
      kind: 'comment',
      payload: { text: 'Review this' },
      quotedText: 'selected text',
      status: 'active',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const service = { get: vi.fn(() => annotation) };
    const renderBubble = vi.fn(({ nodeKey }: { nodeKey: string | null }) => (
      <div data-testid="annotation-bubble">{nodeKey}</div>
    ));
    mocks.kernelEditor.requireService.mockImplementation(() => service as any);
    mocks.anchor.dataset.annotationIds = 'comment-1';

    await act(async () => {
      root.render(<ReactNodePropertiesPlugin renderAnnotationBubble={renderBubble} />);
    });

    await act(async () => {
      expect(() => {
        mocks.anchor.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }).not.toThrow();
    });
    expect(mocks.lexicalEditor.read).toHaveBeenCalled();
    expect(renderBubble).toHaveBeenCalledWith(
      expect.objectContaining({ nodeKey: 'text-1', records: [annotation] }),
    );
    expect(document.querySelector('[data-testid="annotation-bubble"]')?.textContent).toBe('text-1');
  });

  it('delegates annotation clicks to the host without opening a bubble', async () => {
    const annotation = {
      createdAt: '2024-01-01T00:00:00.000Z',
      id: 'comment-1',
      kind: 'comment',
      payload: { text: 'Review this' },
      quotedText: 'selected text',
      status: 'active',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const service = { get: vi.fn(() => annotation) };
    const onAnnotationClick = vi.fn();
    const renderBubble = vi.fn(() => <div data-testid="annotation-bubble" />);
    const block = document.createElement('div');
    block.dataset.blockId = 'block-1';
    const sibling = document.createElement('span');
    sibling.dataset.annotationIds = 'comment-2';
    block.append(mocks.anchor, sibling);
    mocks.editorRoot.append(block);
    mocks.kernelEditor.requireService.mockImplementation(() => service as any);
    mocks.anchor.dataset.annotationIds = 'comment-1';

    await act(async () => {
      root.render(
        <ReactNodePropertiesPlugin
          onAnnotationClick={onAnnotationClick}
          renderAnnotationBubble={renderBubble}
        />,
      );
    });

    await act(async () => {
      mocks.anchor.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onAnnotationClick).toHaveBeenCalledWith(
      expect.objectContaining({
        ids: ['comment-1'],
        groupIds: ['comment-1', 'comment-2'],
        nodeKey: 'text-1',
        records: [annotation],
        rect: expect.objectContaining({ top: 0 }),
      }),
    );
    expect(renderBubble).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="annotation-bubble"]')).toBeNull();
    block.remove();
  });

  it('maps a block-wrapper annotation click back to its logical child key', async () => {
    const annotation = {
      createdAt: '2024-01-01T00:00:00.000Z',
      id: 'artifact-comment',
      kind: 'comment',
      payload: { text: 'Review artifact' },
      quotedText: '',
      status: 'active',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const service = { get: vi.fn(() => annotation) };
    const onAnnotationClick = vi.fn();
    const block = document.createElement('div');
    const title = document.createElement('input');
    const code = document.createElement('div');
    block.dataset.blockId = 'artifact-key';
    block.dataset.annotationIds = 'artifact-comment';
    block.dataset.annotationScope = 'block';
    title.className = 'artifact-title';
    code.className = 'cm-content';
    block.append(title, code);
    mocks.editorRoot.append(block);
    mocks.kernelEditor.requireService.mockImplementation(() => service as any);

    await act(async () => {
      root.render(<ReactNodePropertiesPlugin onAnnotationClick={onAnnotationClick} />);
    });
    await act(async () => {
      block.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onAnnotationClick).toHaveBeenCalledWith(
      expect.objectContaining({
        ids: ['artifact-comment'],
        nodeKey: 'artifact-key',
        records: [annotation],
      }),
    );
    expect(title.dataset.annotationIds).toBeUndefined();
    expect(code.dataset.annotationIds).toBeUndefined();
    block.remove();
  });

  it('submits an explicit block target from the existing composer', async () => {
    await act(async () => {
      root.render(
        <ReactNodePropertiesPlugin
          renderComposer={({ submit }) => (
            <button
              data-testid="submit-block-comment"
              type="button"
              onClick={() => submit({ kind: 'comment', payload: { text: 'Block review' } })}
            >
              Submit
            </button>
          )}
        />,
      );
    });

    const rect = new DOMRect(10, 20, 300, 60);
    await act(async () => {
      mocks.kernelEditor.dispatchCommand(OPEN_ANNOTATION_COMPOSER_COMMAND, {
        kind: 'comment',
        nodeKeys: ['block-1'],
        payload: null,
        quotedText: 'Whole block',
        rect,
      });
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="submit-block-comment"]')?.click();
    });

    expect(mocks.kernelEditor.dispatchCommand).toHaveBeenCalledWith(
      CREATE_ANNOTATION_COMMAND,
      expect.objectContaining({
        kind: 'comment',
        nodeKeys: ['block-1'],
        payload: { text: 'Block review' },
        quotedText: 'Whole block',
      }),
    );
  });
});
