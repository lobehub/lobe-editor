import {
  $createParagraphNode,
  $getRoot,
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

    lexicalEditor.dispatchCommand(COPY_COMMAND, null);
    lexicalEditor.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'private text');
    await moment();

    expect(service.getEntries()).toEqual([]);
  });

  it('observes commands without claiming them or retaining payloads', () => {
    const { lexicalEditor, service } = createHeadlessEditor();
    service.setEnabled(true);

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

  it('keeps a bounded ring and supports clearing a snapshot', () => {
    const { lexicalEditor, service } = createHeadlessEditor();
    service.setEnabled(true);

    for (let index = 0; index < 300; index += 1) {
      lexicalEditor.dispatchCommand(UNDO_COMMAND, undefined);
    }

    const entries = service.getEntries();
    expect(entries).toHaveLength(256);
    expect(entries.every((entry) => entry.kind === 'command')).toBe(true);
    service.clear();
    expect(service.getEntries()).toEqual([]);
  });

  it('rebinds native listeners with the root and releases them on detach', () => {
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
    firstRoot.append(firstInput);
    const service = editor.requireService(IEditorDiagnosticsService);
    if (!service) throw new Error('Diagnostics service is missing');
    service.setEnabled(true);

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

  it('keeps native paste, its command, and the async commit under one operation', async () => {
    const editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    editors.push(editor);
    const root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    const lexicalEditor = editor.setRootElement(root);
    const service = editor.requireService(IEditorDiagnosticsService);
    if (!service) throw new Error('Diagnostics service is missing');
    service.setEnabled(true);

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

  it('exposes command entries with stable metadata and selection shape', () => {
    const { lexicalEditor, service } = createHeadlessEditor();
    service.setEnabled(true);
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
