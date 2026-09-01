import type { LexicalEditor } from 'lexical';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ArtifactNode } from '../node/ArtifactNode';
import {
  SELECT_AFTER_ARTIFACT_COMMAND,
  SELECT_BEFORE_ARTIFACT_COMMAND,
} from '../command';
import { ENTER_HOLE_CONTENT_COMMAND } from '@/plugins/common/command';
import ArtifactView from './ArtifactView';
import { artifactStyles } from './style';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const selectionMock = vi.hoisted(() => ({ clear: vi.fn(), selected: false, set: vi.fn() }));
const artifactSelectionMock = vi.hoisted(() => ({ covered: false, directNodeSelection: false }));
const codeMirrorMock = vi.hoisted(() => ({
  loadCodeMirror: vi.fn(() => new Promise(() => {})),
}));

vi.mock('@/editor-kernel/react/useLexicalNodeSelection', () => ({
  useLexicalNodeSelection: () => [selectionMock.selected, selectionMock.set, selectionMock.clear, false],
}));

vi.mock('@/codemirror', () => ({
  loadCodeMirror: codeMirrorMock.loadCodeMirror,
  lobeTheme: {},
}));

vi.mock('./selection', () => ({
  $getArtifactSelectionState: () => ({ ...artifactSelectionMock }),
  EMPTY_ARTIFACT_SELECTION_STATE: { covered: false, directNodeSelection: false },
  useArtifactSelectionState: () => ({ ...artifactSelectionMock }),
}));

describe('ArtifactView', () => {
  beforeEach(() => {
    selectionMock.selected = false;
    selectionMock.clear.mockReset();
    selectionMock.set.mockReset();
    artifactSelectionMock.covered = false;
    artifactSelectionMock.directNodeSelection = false;
    codeMirrorMock.loadCodeMirror.mockReset();
    codeMirrorMock.loadCodeMirror.mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('renders the CodeMirror source pane beside the iframe while editable', () => {
    const editor = {
      isEditable: () => true,
      registerEditableListener: () => vi.fn(),
      update: vi.fn(),
    } as unknown as LexicalEditor;
    const node = {
      getHtml: () => '<h1>Editable</h1>',
      getKey: () => 'artifact-key',
      getTitle: () => 'Editable Artifact',
    } as unknown as ArtifactNode;

    const markup = renderToStaticMarkup(
      <ArtifactView allowScripts={false} editor={editor} node={node} previewHeight={400} />,
    );

    expect(markup).toContain('artifact-header');
    expect(markup).toContain('data-block-menu-anchor="center"');
    expect(markup).toContain('class="cm-textarea"');
    expect(markup).toContain('<iframe');
    expect(markup).toContain('artifact-preview');

    const normalSurface = document.createElement('div');
    normalSurface.className = artifactStyles;
    const normalCode = document.createElement('div');
    normalCode.className = 'artifact-code';
    const normalCodeContent = document.createElement('div');
    normalCodeContent.className = 'cm-content';
    normalCodeContent.textContent = 'visible source';
    normalCode.append(normalCodeContent);
    normalSurface.append(normalCode);
    document.body.append(normalSurface);
    expect(getComputedStyle(normalSurface).userSelect).not.toBe('none');
    expect(getComputedStyle(normalCodeContent).userSelect).not.toBe('none');
    expect(normalCodeContent.textContent).toBe('visible source');
  });

  it('uses one preview-height contract for both panes and supports custom heights', () => {
    const editor = {
      isEditable: () => true,
      registerEditableListener: () => vi.fn(),
      update: vi.fn(),
    } as unknown as LexicalEditor;
    const node = {
      getHtml: () => '<h1>Height</h1>',
      getKey: () => 'artifact-key',
      getTitle: () => 'Height Artifact',
    } as unknown as ArtifactNode;

    const defaultMarkup = renderToStaticMarkup(
      <ArtifactView allowScripts={false} editor={editor} node={node} previewHeight={420} />,
    );
    const customMarkup = renderToStaticMarkup(
      <ArtifactView allowScripts={false} editor={editor} node={node} previewHeight={512} />,
    );

    expect(defaultMarkup).toContain('--lobe-artifact-preview-height:420px');
    expect(defaultMarkup).toContain('height:var(--lobe-artifact-preview-height, 420px)');
    expect(customMarkup).toContain('--lobe-artifact-preview-height:512px');
    expect(customMarkup).toContain('height:var(--lobe-artifact-preview-height, 512px)');

    const styleText = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText)
      .join('\n');
    expect(styleText).not.toContain('360px');
    expect(
      styleText.match(/var\(--lobe-artifact-preview-height, 420px\)/g)?.length,
    ).toBeGreaterThanOrEqual(7);
    const bodyRule = styleText.split('\n').find((rule) => rule.includes('.artifact-body {'));
    expect(bodyRule).toContain('min-height: var(--lobe-artifact-preview-height, 420px)');
    expect(bodyRule).not.toMatch(/(?:^|[;{]\s*)height:/);
  });

  it('uses the block selection class instead of native surface selection', () => {
    selectionMock.selected = true;
    artifactSelectionMock.covered = true;
    const editor = {
      isEditable: () => true,
      registerEditableListener: () => vi.fn(),
      update: vi.fn(),
    } as unknown as LexicalEditor;
    const node = {
      getHtml: () => '<h1>Selected</h1>',
      getKey: () => 'artifact-key',
      getTitle: () => 'Selected Artifact',
    } as unknown as ArtifactNode;

    const markup = renderToStaticMarkup(
      <ArtifactView allowScripts={false} editor={editor} node={node} previewHeight={400} />,
    );

    expect(markup).toContain('artifact-selected');

    const surface = document.createElement('div');
    surface.className = `${artifactStyles} artifact-selected`;
    const codeContent = document.createElement('div');
    codeContent.className = 'cm-content';
    const syntax = document.createElement('span');
    syntax.className = 'ͼ1';
    syntax.style.color = 'rgb(255, 0, 0)';
    syntax.textContent = 'const selected = true;';
    codeContent.append(syntax);
    const code = document.createElement('div');
    code.className = 'artifact-code';
    code.append(codeContent);
    surface.append(code);
    document.body.append(surface);

    expect(getComputedStyle(surface).userSelect).toBe('none');
    expect(getComputedStyle(codeContent).userSelect).toBe('none');
    expect(codeContent.textContent).toBe('const selected = true;');
    expect(getComputedStyle(syntax).color).not.toBe('transparent');
    const styleRules = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText);
    const styleText = styleRules.join('\n');
    expect(styleText).toContain('.artifact-selected::after');
    expect(styleText).not.toContain('.artifact-selected ::selection');
    expect(styleText).toContain('pointer-events: none');
    const overlayRule = styleRules.find(
      (rule) => rule.includes(`.${artifactStyles}::after`) && !rule.includes('artifact-selected'),
    );
    expect(overlayRule).toContain('color-warning');
    expect(overlayRule).not.toContain('box-shadow');
    expect(overlayRule).not.toContain('outline');
    expect(overlayRule).not.toContain('border');
    surface.remove();
  });

  it('drops direct block selection before CodeMirror interaction', async () => {
    selectionMock.selected = true;
    artifactSelectionMock.covered = true;
    artifactSelectionMock.directNodeSelection = true;
    const editor = {
      getEditorState: () => ({ read: (callback: () => unknown) => callback() }),
      isEditable: () => true,
      registerEditableListener: () => vi.fn(),
      registerCommand: () => vi.fn(),
      registerUpdateListener: () => vi.fn(),
      update: vi.fn(),
    } as unknown as LexicalEditor;
    const node = {
      getHtml: () => '<h1>Editable</h1>',
      getKey: () => 'artifact-key',
      getTitle: () => 'Editable Artifact',
    } as unknown as ArtifactNode;
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ArtifactView allowScripts={false} editor={editor} node={node} previewHeight={400} />,
      );
    });
    expect(host.querySelector(`.${artifactStyles}`)?.classList).toContain('artifact-selected');

    await act(async () => {
      host
        .querySelector('.artifact-code')
        ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    expect(selectionMock.clear).toHaveBeenCalledOnce();
    expect(host.querySelector(`.${artifactStyles}`)?.classList).not.toContain('artifact-selected');
    await act(async () => root.unmount());
  });

  it('selects the Artifact block when its surface is clicked', async () => {
    const editor = {
      isEditable: () => true,
      registerEditableListener: () => vi.fn(),
      registerCommand: () => vi.fn(),
      registerUpdateListener: () => vi.fn(),
      update: vi.fn(),
    } as unknown as LexicalEditor;
    const node = {
      getHtml: () => '<h1>Clickable</h1>',
      getKey: () => 'artifact-key',
      getTitle: () => 'Clickable Artifact',
    } as unknown as ArtifactNode;
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ArtifactView allowScripts={false} editor={editor} node={node} previewHeight={400} />,
      );
    });
    await act(async () => {
      host.querySelector(`.${artifactStyles}`)?.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
      );
    });

    expect(selectionMock.set).toHaveBeenCalledWith(true);
    await act(async () => root.unmount());
  });

  it('does not auto-focus CodeMirror for a direct block selection', async () => {
    artifactSelectionMock.covered = true;
    artifactSelectionMock.directNodeSelection = true;
    const focus = vi.fn();
    const instance = {
      blur: vi.fn(),
      destroy: vi.fn(),
      focus,
      getValue: () => '<h1>Selected</h1>',
      on: vi.fn(),
      optionHelper: { theme: { reconfigure: vi.fn() } },
      view: {
        constructor: { theme: vi.fn(() => ({})) },
        dispatch: vi.fn(),
      },
    };
    codeMirrorMock.loadCodeMirror.mockResolvedValue({
      fromTextArea: vi.fn(() => instance),
    } as never);
    const editor = {
      isEditable: () => true,
      registerEditableListener: () => vi.fn(),
      registerCommand: () => vi.fn(),
      registerUpdateListener: () => vi.fn(),
      update: vi.fn(),
    } as unknown as LexicalEditor;
    const node = {
      getHtml: () => '<h1>Selected</h1>',
      getKey: () => 'artifact-key',
      getTitle: () => 'Selected Artifact',
    } as unknown as ArtifactNode;
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ArtifactView allowScripts={false} editor={editor} node={node} previewHeight={400} />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(focus).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it('focuses CodeMirror and places the source caret at the requested edge', async () => {
    const handlers = new Map<any, (payload: any) => boolean>();
    const focus = vi.fn();
    const setSelectionToStart = vi.fn();
    const setSelectionToEnd = vi.fn();
    const instance = {
      blur: vi.fn(),
      destroy: vi.fn(),
      focus,
      getValue: () => '<h1>Edges</h1>',
      on: vi.fn(),
      optionHelper: { theme: { reconfigure: vi.fn() } },
      setSelectionToEnd,
      setSelectionToStart,
      view: {
        constructor: { theme: vi.fn(() => ({})) },
        dispatch: vi.fn(),
      },
    };
    codeMirrorMock.loadCodeMirror.mockResolvedValue({
      fromTextArea: vi.fn(() => instance),
    } as never);
    const editor = {
      isEditable: () => true,
      registerCommand: vi.fn((command, handler) => {
        handlers.set(command, handler);
        return () => handlers.delete(command);
      }),
      registerEditableListener: () => vi.fn(),
      registerUpdateListener: () => vi.fn(),
      update: vi.fn(),
    } as unknown as LexicalEditor;
    const node = {
      getHtml: () => '<h1>Edges</h1>',
      getKey: () => 'artifact-key',
      getTitle: () => 'Edge Artifact',
    } as unknown as ArtifactNode;
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ArtifactView allowScripts={false} editor={editor} node={node} previewHeight={400} />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(handlers.get(ENTER_HOLE_CONTENT_COMMAND)?.({ edge: 'start', key: 'artifact-key' })).toBe(
      true,
    );
    expect(focus).toHaveBeenCalledOnce();
    expect(setSelectionToStart).toHaveBeenCalledOnce();
    expect(setSelectionToEnd).not.toHaveBeenCalled();

    expect(handlers.get(ENTER_HOLE_CONTENT_COMMAND)?.({ edge: 'end', key: 'artifact-key' })).toBe(
      true,
    );
    expect(focus).toHaveBeenCalledTimes(2);
    expect(setSelectionToEnd).toHaveBeenCalledOnce();
    expect(handlers.get(ENTER_HOLE_CONTENT_COMMAND)?.({ edge: 'start', key: 'other' })).toBe(false);
    await act(async () => root.unmount());
  });

  it('focuses the fallback textarea and places its caret at the requested edge', async () => {
    const handlers = new Map<any, (payload: any) => boolean>();
    codeMirrorMock.loadCodeMirror.mockRejectedValue(new Error('CDN unavailable'));
    const editor = {
      isEditable: () => true,
      registerCommand: vi.fn((command, handler) => {
        handlers.set(command, handler);
        return () => handlers.delete(command);
      }),
      registerEditableListener: () => vi.fn(),
      registerUpdateListener: () => vi.fn(),
      update: vi.fn(),
    } as unknown as LexicalEditor;
    const node = {
      getHtml: () => '<h1>Fallback edges</h1>',
      getKey: () => 'artifact-key',
      getTitle: () => 'Fallback Artifact',
    } as unknown as ArtifactNode;
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ArtifactView allowScripts={false} editor={editor} node={node} previewHeight={400} />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const fallback = host.querySelector<HTMLTextAreaElement>('.artifact-code-fallback');
    if (!fallback) throw new Error('fallback textarea missing');
    const focus = vi.spyOn(fallback, 'focus');
    const setSelectionRange = vi.spyOn(fallback, 'setSelectionRange');
    expect(handlers.get(ENTER_HOLE_CONTENT_COMMAND)?.({ edge: 'end', key: 'artifact-key' })).toBe(
      true,
    );
    expect(focus).toHaveBeenCalledOnce();
    expect(setSelectionRange).toHaveBeenCalledWith(fallback.value.length, fallback.value.length);
    await act(async () => root.unmount());
  });

  it('returns to the Hole boundary when CodeMirror exits either side', async () => {
    const handlers = new Map<string, () => void>();
    const instance = {
      blur: vi.fn(),
      destroy: vi.fn(),
      focus: vi.fn(),
      getValue: () => '<h1>Exit</h1>',
      on: vi.fn((event: string, handler: () => void) => {
        handlers.set(event, handler);
      }),
      optionHelper: { theme: { reconfigure: vi.fn() } },
      setSelectionToEnd: vi.fn(),
      setSelectionToStart: vi.fn(),
      view: {
        constructor: { theme: vi.fn(() => ({})) },
        dispatch: vi.fn(),
      },
    };
    codeMirrorMock.loadCodeMirror.mockResolvedValue({
      fromTextArea: vi.fn(() => instance),
    } as never);
    const dispatchCommand = vi.fn();
    const editor = {
      dispatchCommand,
      isEditable: () => true,
      registerCommand: () => vi.fn(),
      registerEditableListener: () => vi.fn(),
      registerUpdateListener: () => vi.fn(),
      update: vi.fn(),
    } as unknown as LexicalEditor;
    const node = {
      getHtml: () => '<h1>Exit</h1>',
      getKey: () => 'artifact-key',
      getTitle: () => 'Exit Artifact',
    } as unknown as ArtifactNode;
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ArtifactView allowScripts={false} editor={editor} node={node} previewHeight={400} />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    handlers.get('leftOut')?.();
    expect(instance.blur).toHaveBeenCalledOnce();
    expect(dispatchCommand).toHaveBeenCalledWith(SELECT_BEFORE_ARTIFACT_COMMAND, {
      key: 'artifact-key',
    });
    handlers.get('rightOut')?.();
    expect(instance.blur).toHaveBeenCalledTimes(2);
    expect(dispatchCommand).toHaveBeenCalledWith(SELECT_AFTER_ARTIFACT_COMMAND, {
      key: 'artifact-key',
    });
    await act(async () => root.unmount());
  });

  it('keeps a visible editable source fallback when CodeMirror fails to load', async () => {
    codeMirrorMock.loadCodeMirror.mockRejectedValue(new Error('CDN unavailable'));
    const editor = {
      isEditable: () => true,
      registerEditableListener: () => vi.fn(),
      registerCommand: () => vi.fn(),
      registerUpdateListener: () => vi.fn(),
      update: vi.fn(),
    } as unknown as LexicalEditor;
    const node = {
      getHtml: () => '<h1>Fallback</h1>',
      getKey: () => 'artifact-key',
      getTitle: () => 'Fallback Artifact',
    } as unknown as ArtifactNode;
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ArtifactView allowScripts={false} editor={editor} node={node} previewHeight={400} />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const fallback = host.querySelector<HTMLTextAreaElement>('.artifact-code-fallback');
    expect(fallback?.value).toBe('<h1>Fallback</h1>');
    expect(fallback?.readOnly).toBe(false);
    expect(fallback?.style.opacity).toBe('1');
    await act(async () => root.unmount());
  });

  it('does not update state after unmount while CodeMirror is loading', async () => {
    let rejectLoad: (reason?: unknown) => void = () => undefined;
    codeMirrorMock.loadCodeMirror.mockImplementation(
      () => new Promise((_, reject) => (rejectLoad = reject)),
    );
    const editor = {
      isEditable: () => true,
      registerEditableListener: () => vi.fn(),
      registerCommand: () => vi.fn(),
      registerUpdateListener: () => vi.fn(),
      update: vi.fn(),
    } as unknown as LexicalEditor;
    const node = {
      getHtml: () => '<h1>Unmounted</h1>',
      getKey: () => 'artifact-key',
      getTitle: () => 'Unmounted Artifact',
    } as unknown as ArtifactNode;
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ArtifactView allowScripts={false} editor={editor} node={node} previewHeight={400} />,
      );
    });
    await act(async () => root.unmount());
    rejectLoad(new Error('late failure'));
    await Promise.resolve();
    expect(host.innerHTML).toBe('');
  });

  it('renders only the iframe preview when the editor is readonly', () => {
    const editor = {
      isEditable: () => false,
      registerEditableListener: () => vi.fn(),
      update: vi.fn(),
    } as unknown as LexicalEditor;
    const node = {
      getHtml: () => '<h1>Readonly</h1>',
      getKey: () => 'artifact-key',
      getTitle: () => 'Readonly Artifact',
    } as unknown as ArtifactNode;

    const markup = renderToStaticMarkup(
      <ArtifactView allowScripts={false} editor={editor} node={node} previewHeight={400} />,
    );

    expect(markup).toContain('<iframe');
    expect(markup).toContain('srcDoc="&lt;h1&gt;Readonly&lt;/h1&gt;"');
    expect(markup).not.toContain('<textarea');
    expect(markup).not.toContain('<input');
    expect(markup).not.toContain('artifact-header');
    expect(markup).not.toContain('artifact-selected');
  });
});
