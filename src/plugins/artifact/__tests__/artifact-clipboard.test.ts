import {
  $createNodeSelection,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $nodesOfType,
  $setSelection,
  COPY_COMMAND,
  CUT_COMMAND,
  PASTE_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { HoleNode } from '@/plugins/common/node/hole';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { INSERT_ARTIFACT_COMMAND } from '../command';
import { ArtifactNode } from '../node/ArtifactNode';
import { ArtifactPlugin } from '../plugin';

class MockClipboardEvent extends Event {
  constructor(
    type: string,
    readonly clipboardData: DataTransfer,
  ) {
    super(type, { bubbles: true, cancelable: true });
  }
}

const createClipboard = (initial?: ReadonlyMap<string, string>) => {
  const values = new Map(initial);
  const clipboardData = {
    clearData: (type?: string) => {
      if (type) values.delete(type);
      else values.clear();
    },
    files: [],
    getData: (type: string) => values.get(type) || '',
    setData: (type: string, value: string) => {
      values.set(type, value);
    },
    get types() {
      return [...values.keys()];
    },
  } as unknown as DataTransfer;
  return { clipboardData, values };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Artifact Hole clipboard', () => {
  let editor: IEditor;

  beforeEach(async () => {
    vi.stubGlobal('ClipboardEvent', MockClipboardEvent);
    editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, ArtifactPlugin]);
    editor.initNodeEditor();
    editor.setDocument('json', {
      root: {
        children: [
          {
            children: [],
            direction: null,
            format: '',
            indent: 0,
            textFormat: 0,
            textStyle: '',
            type: 'paragraph',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    });
    editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, {
      html: '<main>clipboard</main>',
      title: 'Clipboard',
    });
    await moment();
  });

  afterEach(() => {
    editor.destroy();
    vi.unstubAllGlobals();
  });

  const selectArtifact = () => {
    editor.getLexicalEditor()!.update(() => {
      const artifact = $nodesOfType(ArtifactNode)[0];
      if (!artifact) throw new Error('Artifact missing');
      const selection = $createNodeSelection();
      selection.add(artifact.getKey());
      $setSelection(selection);
    });
  };

  const expectSingleValidHole = () => {
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const holes = $nodesOfType(HoleNode);
        expect(holes).toHaveLength(1);
        expect(holes[0].getChildren().map((child) => child.getType())).toEqual([
          'cursor',
          'artifact',
          'cursor',
        ]);
        expect($nodesOfType(ArtifactNode)).toHaveLength(1);
      });
  };

  it('copies the atomic Hole, cuts it cleanly, and pastes one normalized Hole without looping', async () => {
    const editorErrors: Error[] = [];
    (editor as unknown as { on: (type: string, listener: (error: Error) => void) => void }).on(
      'error',
      (error) => editorErrors.push(error),
    );
    selectArtifact();
    await moment();

    const copied = createClipboard();
    editor
      .getLexicalEditor()!
      .dispatchCommand(COPY_COMMAND, new MockClipboardEvent('copy', copied.clipboardData));
    await flush();

    const lexicalPayload = JSON.parse(copied.values.get('application/x-lexical-editor') || '{}');
    expect(lexicalPayload.nodes).toHaveLength(1);
    expect(lexicalPayload.nodes[0].type).toBe('hole');
    expect(lexicalPayload.nodes[0].children.map((child: any) => child.type)).toEqual([
      'cursor',
      'artifact',
      'cursor',
    ]);
    expectSingleValidHole();

    let updateCount = 0;
    const unregister = editor.getLexicalEditor()!.registerUpdateListener(() => {
      updateCount += 1;
    });
    const cut = createClipboard();
    editor
      .getLexicalEditor()!
      .dispatchCommand(CUT_COMMAND, new MockClipboardEvent('cut', cut.clipboardData));
    await flush();
    await flush();

    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(HoleNode)).toHaveLength(0);
        expect($nodesOfType(ArtifactNode)).toHaveLength(0);
        expect(
          $getRoot()
            .getChildren()
            .every((node) => node.getType() === 'paragraph'),
        ).toBe(true);
        const selection = $getSelection();
        expect($isRangeSelection(selection)).toBe(true);
        expect(selection?.getNodes().every((node) => node.isAttached())).toBe(true);
      });

    const settledUpdateCount = updateCount;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(updateCount).toBe(settledUpdateCount);
    expect(updateCount).toBeLessThan(8);

    const paste = createClipboard(cut.values);
    expect(cut.values.get('application/x-lexical-editor')).toBeTruthy();
    expect(
      editor
        .getLexicalEditor()!
        .dispatchCommand(PASTE_COMMAND, new MockClipboardEvent('paste', paste.clipboardData)),
    ).toBe(true);
    await flush();
    await flush();
    expectSingleValidHole();

    const afterPasteUpdateCount = updateCount;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(updateCount).toBe(afterPasteUpdateCount);
    expect(editorErrors).toEqual([]);
    unregister();
  });

  it('undoes and redoes an atomic cut without leaving an empty Hole', async () => {
    selectArtifact();
    await moment();
    await new Promise((resolve) => setTimeout(resolve, 600));

    const cut = createClipboard();
    editor
      .getLexicalEditor()!
      .dispatchCommand(CUT_COMMAND, new MockClipboardEvent('cut', cut.clipboardData));
    await flush();
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 600));

    editor.getLexicalEditor()!.dispatchCommand(UNDO_COMMAND, undefined);
    await flush();
    expectSingleValidHole();

    editor.getLexicalEditor()!.dispatchCommand(REDO_COMMAND, undefined);
    await flush();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(HoleNode)).toHaveLength(0);
        expect($nodesOfType(ArtifactNode)).toHaveLength(0);
      });
  });

  it('does not throw when a same-namespace clipboard payload is malformed', async () => {
    const editorErrors: Error[] = [];
    (editor as unknown as { on: (type: string, listener: (error: Error) => void) => void }).on(
      'error',
      (error) => editorErrors.push(error),
    );

    const malformed = createClipboard(
      new Map([
        [
          'application/x-lexical-editor',
          JSON.stringify({
            namespace: editor.getLexicalEditor()?._config.namespace,
            nodes: [
              {
                children: [
                  { text: '\uFEFF', type: 'cursor', version: 1 },
                  { type: 'not-registered', version: 1 },
                  { text: '\uFEFF', type: 'cursor', version: 1 },
                ],
                type: 'hole',
                version: 1,
              },
            ],
          }),
        ],
      ]),
    );

    expect(() =>
      editor
        .getLexicalEditor()!
        .dispatchCommand(PASTE_COMMAND, new MockClipboardEvent('paste', malformed.clipboardData)),
    ).not.toThrow();
    await flush();
    expect(editorErrors).toEqual([]);
    expectSingleValidHole();
  });
});
