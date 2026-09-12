import {
  $createParagraphNode,
  $getRoot,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  COPY_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';

import {
  type EditorDiagnosticsCommandEntry,
  type EditorDiagnosticsNativeEntry,
  IEditorDiagnosticsService,
} from './i-editor-diagnostics-service';

const editors: Array<ReturnType<typeof Editor.createEditor>> = [];

afterEach(() => {
  while (editors.length > 0) editors.pop()?.destroy();
});

const createHeadlessEditor = () => {
  const editor = Editor.createEditor().registerPlugins([CommonPlugin]);
  editors.push(editor);
  editor.initHeadlessEditor();
  const lexicalEditor = editor.getLexicalEditor();
  const service = editor.requireService(IEditorDiagnosticsService);
  if (!lexicalEditor || !service) throw new Error('Diagnostics editor setup failed');
  return { editor, lexicalEditor, service };
};

describe('EditorDiagnosticsService', () => {
  it('does not capture anything while disabled', async () => {
    const { lexicalEditor, service } = createHeadlessEditor();

    expect((service as unknown as { capture: unknown }).capture).toBeNull();

    lexicalEditor.dispatchCommand(COPY_COMMAND, null);
    lexicalEditor.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'private text');
    await moment();

    expect(service.getEntries()).toEqual([]);
  });

  it('keeps the early command bridge ahead of downstream critical handlers', async () => {
    const { lexicalEditor, service } = createHeadlessEditor();
    let downstreamCalls = 0;
    const unregister = lexicalEditor.registerCommand(
      COPY_COMMAND,
      () => {
        downstreamCalls += 1;
        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
    await service.setEnabled(true);

    lexicalEditor.dispatchCommand(COPY_COMMAND, null);

    expect(service.getEntries().filter((entry) => entry.kind === 'command')).toHaveLength(1);
    expect(downstreamCalls).toBe(1);
    unregister();
  });

  it('does not attach a collector after disable or destroy races with loading', async () => {
    const first = createHeadlessEditor();
    const firstReady = first.service.setEnabled(true);
    await first.service.setEnabled(false);
    await firstReady;
    first.lexicalEditor.dispatchCommand(COPY_COMMAND, null);
    expect(first.service.getEntries()).toEqual([]);

    const second = createHeadlessEditor();
    const secondReady = second.service.setEnabled(true);
    second.editor.destroy();
    await secondReady;
    second.lexicalEditor.dispatchCommand(COPY_COMMAND, null);
    expect(second.service.getEntries()).toEqual([]);
  });

  it('does not duplicate capture across repeated enables', async () => {
    const { lexicalEditor, service } = createHeadlessEditor();
    await service.setEnabled(true);
    const firstCapture = (service as unknown as { capture: unknown }).capture;
    await service.setEnabled(false);
    await service.setEnabled(true);
    expect((service as unknown as { capture: unknown }).capture).toBe(firstCapture);
    lexicalEditor.dispatchCommand(COPY_COMMAND, null);

    expect(service.getEntries().filter((entry) => entry.kind === 'command')).toHaveLength(1);
  });

  it('observes commands without claiming them or retaining payloads', async () => {
    const { lexicalEditor, service } = createHeadlessEditor();
    await service.setEnabled(true);

    let downstreamCalls = 0;
    const unregister = lexicalEditor.registerCommand(
      COPY_COMMAND,
      () => {
        downstreamCalls += 1;
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );

    expect(lexicalEditor.dispatchCommand(COPY_COMMAND, null)).toBe(true);
    lexicalEditor.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'private text');

    expect(downstreamCalls).toBe(1);
    const entries = service.getEntries();
    expect(entries.filter((entry) => entry.kind === 'command')).toHaveLength(2);
    expect(JSON.stringify(entries)).not.toContain('private text');
    unregister();
  });

  it('keeps a bounded ring and supports clearing a snapshot', async () => {
    const { lexicalEditor, service } = createHeadlessEditor();
    await service.setEnabled(true);

    for (let index = 0; index < 300; index += 1) {
      lexicalEditor.dispatchCommand(UNDO_COMMAND, undefined);
    }

    const entries = service.getEntries();
    expect(entries).toHaveLength(256);
    expect(entries.every((entry) => entry.kind === 'command')).toBe(true);
    service.clear();
    expect(service.getEntries()).toEqual([]);
  });

  it('rebinds native listeners with the root and releases them on detach', async () => {
    const editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    editors.push(editor);
    const firstRoot = document.createElement('div');
    const secondRoot = document.createElement('div');
    const firstInput = document.createElement('input');
    const secondInput = document.createElement('input');
    firstRoot.contentEditable = 'true';
    secondRoot.contentEditable = 'true';
    document.body.append(firstRoot, secondRoot);

    editor.setRootElement(firstRoot);
    const service = editor.requireService(IEditorDiagnosticsService);
    if (!service) throw new Error('Diagnostics service is missing');
    await service.setEnabled(true);
    firstRoot.append(firstInput);

    firstInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 's' }));
    expect(service.getEntries()).toHaveLength(1);
    const firstEntry = service.getEntries()[0] as EditorDiagnosticsNativeEntry;
    expect(firstEntry.target).toBe('input');
    expect(firstEntry.keyCategory).toBe('printable');
    expect(JSON.stringify(firstEntry)).not.toContain('secret-input');

    editor.setRootElement(secondRoot);
    secondRoot.append(secondInput);
    firstInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'old' }));
    secondInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'new' }));
    expect(service.getEntries().filter((entry) => entry.kind === 'native')).toHaveLength(2);

    editor.setRootElement(null);
    secondInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'after detach' }));
    expect(service.getEntries().filter((entry) => entry.kind === 'native')).toHaveLength(2);

    document.body.removeChild(firstRoot);
    document.body.removeChild(secondRoot);
  });

  it('disables native capture synchronously when the returned promise is ignored', async () => {
    const editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    editors.push(editor);
    const root = document.createElement('div');
    const input = document.createElement('input');
    root.contentEditable = 'true';
    document.body.append(root);
    editor.setRootElement(root);
    const service = editor.requireService(IEditorDiagnosticsService);
    if (!service) throw new Error('Diagnostics service is missing');
    await service.setEnabled(true);
    root.append(input);

    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'before-disable' }));
    expect(service.getEntries().filter((entry) => entry.kind === 'native')).toHaveLength(1);

    const disabling = service.setEnabled(false);
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'after-disable' }));
    expect(service.getEntries().filter((entry) => entry.kind === 'native')).toHaveLength(1);
    await disabling;

    document.body.removeChild(root);
  });

  it('keeps native paste, its command, and the async commit under one operation', async () => {
    const editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    editors.push(editor);
    const root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    const lexicalEditor = editor.setRootElement(root);
    const service = editor.requireService(IEditorDiagnosticsService);
    if (!service) throw new Error('Diagnostics service is missing');
    await service.setEnabled(true);

    root.addEventListener('paste', () => {
      lexicalEditor.update(() => {
        $getRoot().append($createParagraphNode());
      });
    });
    root.dispatchEvent(new Event('paste', { bubbles: true }));
    await moment();

    const entries = service.getEntries();
    const nativePaste = entries.find((entry) => entry.kind === 'native' && entry.event === 'paste');
    const pasteCommand = entries.find(
      (entry) => entry.kind === 'command' && entry.command === 'PASTE_COMMAND',
    );
    const update = entries.find((entry) => entry.kind === 'update');
    expect(nativePaste?.opId).toBeDefined();
    expect(pasteCommand?.opId).toBe(nativePaste?.opId);
    expect(update?.opId).toBe(nativePaste?.opId);

    document.body.removeChild(root);
  });

  it('exposes command entries with stable metadata and selection shape', async () => {
    const { lexicalEditor, service } = createHeadlessEditor();
    await service.setEnabled(true);
    lexicalEditor.dispatchCommand(COPY_COMMAND, null);

    const entry = service.getEntries().find((item) => item.kind === 'command') as
      EditorDiagnosticsCommandEntry | undefined;
    expect(entry).toMatchObject({
      command: 'COPY_COMMAND',
      kind: 'command',
      selection: {
        nodeTypes: expect.any(Array),
        runtimeKeys: expect.any(Array),
      },
    });
    expect(entry?.editorId).toMatch(/^editor-/);
    expect(entry?.opId).toMatch(/^editor-\d+:op-\d+$/);
    expect(entry?.seq).toBeGreaterThan(0);
    expect(entry?.time).toBeGreaterThan(0);
  });
});
