import {
  $createNodeSelection,
  $getRoot,
  $getSelection,
  COMMAND_PRIORITY_EDITOR,
  $isNodeSelection,
  $isRangeSelection,
  $nodesOfType,
  $setSelection,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_DELETE_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { ArtifactPlugin } from '@/plugins/artifact/plugin';
import { CommonPlugin } from '@/plugins/common/plugin';
import type { IEditor } from '@/types';

import { HoleNode } from './hole';
import { ENTER_HOLE_CONTENT_COMMAND } from '../command';

const artifact = {
  html: '<main>navigation</main>',
  title: 'Navigation',
  type: 'artifact',
  version: 1,
};

const paragraph = (text: string) => ({
  children: [
    {
      detail: 0,
      format: 0,
      mode: 'normal',
      style: '',
      text,
      type: 'text',
      version: 1,
    },
  ],
  direction: null,
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
});

const documentWith = (...children: unknown[]) => ({
  root: {
    children,
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
});

describe('Hole boundary cursor navigation', () => {
  let editor: IEditor;

  beforeEach(async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, ArtifactPlugin]);
    editor.initNodeEditor();
    editor.setDocument('json', documentWith(paragraph('before'), artifact, paragraph('after')));
    await moment();
  });

  const selectBoundary = (side: 'after' | 'before') => {
    editor.getLexicalEditor()!.update(
      () => {
        const hole = $nodesOfType(HoleNode)[0];
        const cursor = side === 'before' ? hole.getBeforeCursor() : hole.getAfterCursor();
        if (!cursor) throw new Error('Hole cursor missing');
        if (side === 'before') cursor.selectEnd();
        else cursor.selectStart();
      },
      { discrete: true },
    );
  };

  const dispatchArrow = (direction: 'left' | 'right', shiftKey = false) => {
    const event = new KeyboardEvent('keydown', {
      cancelable: true,
      key: direction === 'left' ? 'ArrowLeft' : 'ArrowRight',
      shiftKey,
    });
    const command = direction === 'left' ? KEY_ARROW_LEFT_COMMAND : KEY_ARROW_RIGHT_COMMAND;
    expect(editor.getLexicalEditor()!.dispatchCommand(command, event)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  };

  it('moves through the Hole once in all four plain directions without selecting the Artifact', async () => {
    selectBoundary('before');
    dispatchArrow('left');
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.anchor.getNode().getTextContent()).toBe('before');
        expect(selection.anchor.offset).toBe(6);
      });

    selectBoundary('before');
    dispatchArrow('right');
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole || !$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.isCollapsed()).toBe(true);
        expect(selection.anchor.key).toBe(hole.getAfterCursor()?.getKey());
        expect(selection.anchor.offset).toBe(0);
        expect(selection.getTextContent()).toBe('');
      });

    selectBoundary('after');
    dispatchArrow('left');
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole || !$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.isCollapsed()).toBe(true);
        expect(selection.anchor.key).toBe(hole.getBeforeCursor()?.getKey());
        expect(selection.anchor.offset).toBe(1);
        expect(selection.getTextContent()).toBe('');
      });

    selectBoundary('after');
    dispatchArrow('right');
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.anchor.getNode().getTextContent()).toBe('after');
        expect(selection.anchor.offset).toBe(0);
      });
  });

  it('creates a legal outside paragraph at document edges and keeps JSON transparent', async () => {
    editor.setDocument('json', documentWith(artifact));
    await moment();
    selectBoundary('before');
    dispatchArrow('left');
    await moment();
    expect(
      editor
        .getLexicalEditor()!
        .getEditorState()
        .read(() =>
          $getRoot()
            .getChildren()
            .map((node) => node.getType()),
        ),
    ).toEqual(['paragraph', 'hole']);

    selectBoundary('after');
    dispatchArrow('right');
    await moment();
    expect(
      editor
        .getLexicalEditor()!
        .getEditorState()
        .read(() =>
          $getRoot()
            .getChildren()
            .map((node) => node.getType()),
        ),
    ).toEqual(['paragraph', 'hole', 'paragraph']);
    expect(JSON.stringify(editor.getDocument('json'))).not.toContain('"hole"');
    expect(JSON.stringify(editor.getDocument('json'))).not.toContain('"cursor"');

    editor.getLexicalEditor()!.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    expect(
      editor
        .getLexicalEditor()!
        .getEditorState()
        .read(() => $nodesOfType(HoleNode).length),
    ).toBe(1);
  });

  it('extends Shift+Arrow across element boundaries without selecting Cursor text', async () => {
    selectBoundary('before');
    dispatchArrow('right', true);
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        if (!$isNodeSelection(selection)) throw new Error('Node selection missing');
        expect(selection.getNodes()).toHaveLength(1);
        expect(selection.getNodes()[0]).toBeInstanceOf(ArtifactNode);
      });

    selectBoundary('after');
    dispatchArrow('left', true);
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        if (!$isNodeSelection(selection)) throw new Error('Node selection missing');
        expect(selection.getNodes()).toHaveLength(1);
        expect(selection.getNodes()[0]).toBeInstanceOf(ArtifactNode);
      });
  });

  it('does not require an extra press to cross the zero-width boundaries', async () => {
    selectBoundary('before');
    dispatchArrow('right');
    await moment();
    dispatchArrow('right');
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.isCollapsed()).toBe(true);
        expect(selection.anchor.getNode().getTextContent()).toBe('after');
        expect(selection.anchor.offset).toBe(0);
      });

    selectBoundary('after');
    dispatchArrow('left');
    await moment();
    dispatchArrow('left');
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.isCollapsed()).toBe(true);
        expect(selection.anchor.getNode().getTextContent()).toBe('before');
        expect(selection.anchor.offset).toBe(6);
      });
  });

  it('requests the content consumer with the payload key and clears Lexical selection', async () => {
    const lexicalEditor = editor.getLexicalEditor()!;
    const artifactKey = lexicalEditor
      .getEditorState()
      .read(() => $nodesOfType(ArtifactNode)[0].getKey());
    const payloads: Array<{ edge: 'end' | 'start'; key: string }> = [];
    const unregister = lexicalEditor.registerCommand(
      ENTER_HOLE_CONTENT_COMMAND,
      (payload) => {
        payloads.push(payload);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    selectBoundary('before');
    dispatchArrow('right', true);
    await moment();
    expect(payloads).toEqual([]);
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isNodeSelection(selection)).toBe(true);
      expect(selection?.getNodes()[0]).toBeInstanceOf(ArtifactNode);
    });

    selectBoundary('after');
    dispatchArrow('left', true);
    await moment();
    expect(payloads).toEqual([]);
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isNodeSelection(selection)).toBe(true);
      expect(selection?.getNodes()[0]).toBeInstanceOf(ArtifactNode);
    });

    selectBoundary('before');
    dispatchArrow('right');
    await moment();
    expect(payloads).toEqual([{ edge: 'start', key: artifactKey }]);
    lexicalEditor.getEditorState().read(() => {
      expect($getSelection()).toBeNull();
    });

    selectBoundary('after');
    dispatchArrow('left');
    await moment();
    expect(payloads).toEqual([
      { edge: 'start', key: artifactKey },
      { edge: 'end', key: artifactKey },
    ]);
    lexicalEditor.getEditorState().read(() => {
      expect($getSelection()).toBeNull();
    });

    unregister();
  });

  it('leaves an Artifact NodeSelection through either boundary and then reaches outside text', async () => {
    selectBoundary('before');
    dispatchArrow('right', true);
    await moment();
    dispatchArrow('left', true);
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole || !$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.isCollapsed()).toBe(true);
        expect(selection.anchor.key).toBe(hole.getBeforeCursor()?.getKey());
        expect(selection.anchor.offset).toBe(1);
      });
    dispatchArrow('left');
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.anchor.getNode().getTextContent()).toBe('before');
        expect(selection.anchor.offset).toBe(6);
      });

    selectBoundary('after');
    dispatchArrow('left', true);
    await moment();
    dispatchArrow('right', true);
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole || !$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.isCollapsed()).toBe(true);
        expect(selection.anchor.key).toBe(hole.getAfterCursor()?.getKey());
        expect(selection.anchor.offset).toBe(0);
      });
    dispatchArrow('right');
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.anchor.getNode().getTextContent()).toBe('after');
        expect(selection.anchor.offset).toBe(0);
      });
  });

  it('lets plain arrows leave an Artifact NodeSelection through the matching boundary', async () => {
    selectBoundary('before');
    dispatchArrow('right', true);
    await moment();
    dispatchArrow('left');
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole || !$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.isCollapsed()).toBe(true);
        expect(selection.anchor.key).toBe(hole.getBeforeCursor()?.getKey());
        expect(selection.anchor.offset).toBe(1);
      });

    selectBoundary('after');
    dispatchArrow('left', true);
    await moment();
    dispatchArrow('right');
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole || !$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.isCollapsed()).toBe(true);
        expect(selection.anchor.key).toBe(hole.getAfterCursor()?.getKey());
        expect(selection.anchor.offset).toBe(0);
      });
  });

  it('also exits when NodeSelection contains the Hole wrapper itself', async () => {
    const lexicalEditor = editor.getLexicalEditor()!;
    lexicalEditor.update(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const selection = $createNodeSelection();
      selection.add(hole.getKey());
      $setSelection(selection);
    });
    await moment();
    dispatchArrow('right');
    await moment();
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      const hole = $nodesOfType(HoleNode)[0];
      if (!hole || !$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.isCollapsed()).toBe(true);
      expect(selection.anchor.key).toBe(hole.getAfterCursor()?.getKey());
      expect(selection.anchor.offset).toBe(0);
    });

    lexicalEditor.update(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const selection = $createNodeSelection();
      selection.add(hole.getKey());
      $setSelection(selection);
    });
    await moment();
    dispatchArrow('left', true);
    await moment();
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      const hole = $nodesOfType(HoleNode)[0];
      if (!hole || !$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.isCollapsed()).toBe(true);
      expect(selection.anchor.key).toBe(hole.getBeforeCursor()?.getKey());
      expect(selection.anchor.offset).toBe(1);
    });
  });

  it('leaves multi-node selections untouched', async () => {
    const lexicalEditor = editor.getLexicalEditor()!;
    lexicalEditor.update(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const next = hole.getNextSibling();
      if (!next) throw new Error('Adjacent paragraph missing');
      const selection = $createNodeSelection();
      selection.add(hole.getKey());
      selection.add(next.getKey());
      $setSelection(selection);
    });
    await moment();

    const event = new KeyboardEvent('keydown', {
      cancelable: true,
      key: 'ArrowRight',
    });
    lexicalEditor.dispatchCommand(KEY_ARROW_RIGHT_COMMAND, event);
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isNodeSelection(selection)).toBe(true);
      expect(selection?.getNodes()).toHaveLength(2);
    });
  });

  it.each([
    { side: 'before' as const, expectedText: 'after', expectedTypes: ['paragraph', 'paragraph'] },
    { side: 'after' as const, expectedText: 'after', expectedTypes: ['paragraph', 'hole', 'paragraph'] },
  ])('owns Delete at the $side boundary without leaking runtime nodes', async ({ side, expectedText, expectedTypes }) => {
    selectBoundary(side);
    const event = new KeyboardEvent('keydown', {
      cancelable: true,
      key: 'Delete',
    });
    expect(editor.getLexicalEditor()!.dispatchCommand(KEY_DELETE_COMMAND, event)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    await moment();
    await moment();

    editor.getLexicalEditor()!.getEditorState().read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(expectedTypes);
      const paragraphs = $getRoot()
        .getChildren()
        .filter((node) => node.getType() === 'paragraph');
      expect(paragraphs.at(-1)?.getTextContent()).toBe(expectedText);
    });
  });
});
