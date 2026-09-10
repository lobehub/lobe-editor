import {
  $createNodeSelection,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $nodesOfType,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import {
  $createTableNodeWithDimensions,
  type TableCellNode,
  type TableRowNode,
} from '@lexical/table';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { $createArtifactNode, ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { ArtifactPlugin } from '@/plugins/artifact/plugin';
import { CodemirrorPlugin } from '@/plugins/codemirror-block/plugin';
import { CommonPlugin } from '@/plugins/common/plugin';
import { ListPlugin } from '@/plugins/list/plugin';
import { TablePlugin } from '@/plugins/table/plugin';
import type { IEditor } from '@/types';

import { ENTER_HOLE_CONTENT_COMMAND } from '../command';
import { $isHoleNode, HoleNode } from './hole';

const artifact = {
  html: '<main>navigation</main>',
  title: 'Navigation',
  type: 'artifact',
  version: 1,
};

const codeBlock = {
  code: 'mixed navigation',
  codeTheme: '',
  language: 'plain',
  options: {
    indentWithTabs: false,
    lineNumbers: false,
    tabSize: 2,
  },
  type: 'code',
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

  const selectBoundaryAt = (index: number, side: 'after' | 'before') => {
    editor.getLexicalEditor()!.update(
      () => {
        const hole = $nodesOfType(HoleNode)[index];
        const cursor = side === 'before' ? hole.getBeforeCursor() : hole.getAfterCursor();
        if (!cursor) throw new Error('Hole cursor missing');
        if (side === 'before') cursor.selectEnd();
        else cursor.selectStart();
      },
      { discrete: true },
    );
  };

  const selectBoundary = (side: 'after' | 'before') => selectBoundaryAt(0, side);

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

  const dispatchVerticalArrow = (
    direction: 'up' | 'down',
    options: KeyboardEventInit = {},
  ): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', {
      cancelable: true,
      key: direction === 'up' ? 'ArrowUp' : 'ArrowDown',
      ...options,
    });
    const command = direction === 'up' ? KEY_ARROW_UP_COMMAND : KEY_ARROW_DOWN_COMMAND;
    editor.getLexicalEditor()!.dispatchCommand(command, event);
    return event;
  };

  const dispatchBackspace = () => {
    const event = new KeyboardEvent('keydown', { cancelable: true, key: 'Backspace' });
    expect(editor.getLexicalEditor()!.dispatchCommand(KEY_BACKSPACE_COMMAND, event)).toBe(true);
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

  it('removes the whole Artifact Hole with Backspace at its after boundary', async () => {
    selectBoundary('after');
    dispatchBackspace();
    await moment();
    await moment();
    await moment();

    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect(
          $getRoot()
            .getChildren()
            .map((node) => node.getType()),
        ).toEqual(['paragraph', 'paragraph']);
        expect($nodesOfType(ArtifactNode)).toHaveLength(0);
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.anchor.getNode().getTextContent()).toBe('after');
        expect(selection.anchor.offset).toBe(0);
      });
  });

  it('keeps a before-boundary Backspace command from deleting the Hole or its payload', async () => {
    selectBoundary('before');
    dispatchBackspace();
    await moment();
    await moment();
    await moment();

    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect(
          $getRoot()
            .getChildren()
            .map((node) => node.getType()),
        ).toEqual(['paragraph', 'hole', 'paragraph']);
        expect($getRoot().getFirstChild()?.getTextContent()).toBe('before');
        expect($nodesOfType(ArtifactNode)).toHaveLength(1);
        const hole = $nodesOfType(HoleNode)[0];
        expect(hole.getContentChildren().some((node) => node instanceof ArtifactNode)).toBe(true);
      });
  });

  it('crosses consecutive Holes through their matching boundary cursors', async () => {
    editor.setDocument(
      'json',
      documentWith(paragraph('left'), artifact, artifact, paragraph('right')),
    );
    await moment();

    selectBoundaryAt(0, 'after');
    dispatchArrow('right');
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const holes = $nodesOfType(HoleNode);
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.anchor.key).toBe(holes[1]?.getBeforeCursor()?.getKey());
        expect(selection.anchor.offset).toBe(0);
      });

    selectBoundaryAt(1, 'before');
    dispatchArrow('left');
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const holes = $nodesOfType(HoleNode);
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.anchor.key).toBe(holes[0]?.getAfterCursor()?.getKey());
        expect(selection.anchor.offset).toBe(1);
        expect(selection.getTextContent()).toBe('');
      });
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(ArtifactNode)).toHaveLength(2);
      });
  });

  it('stops vertical movement at the adjacent Hole instead of skipping a card run', async () => {
    editor.setDocument(
      'json',
      documentWith(paragraph('above'), artifact, artifact, paragraph('below')),
    );
    await moment();

    selectBoundaryAt(0, 'after');
    const down = dispatchVerticalArrow('down');
    expect(down.defaultPrevented).toBe(true);
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const holes = $nodesOfType(HoleNode);
        const selection = $getSelection();
        const beforeCursor = holes[1]?.getBeforeCursor();
        if (!beforeCursor || !$isRangeSelection(selection)) {
          throw new Error('Adjacent Hole boundary selection missing');
        }
        expect(selection.isCollapsed()).toBe(true);
        expect(selection.anchor.key).toBe(beforeCursor.getKey());
        expect(selection.anchor.offset).toBe(beforeCursor.getTextContentSize());
      });

    selectBoundaryAt(1, 'before');
    const up = dispatchVerticalArrow('up');
    expect(up.defaultPrevented).toBe(true);
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const holes = $nodesOfType(HoleNode);
        const selection = $getSelection();
        const afterCursor = holes[0]?.getAfterCursor();
        if (!afterCursor || !$isRangeSelection(selection)) {
          throw new Error('Adjacent Hole boundary selection missing');
        }
        expect(selection.isCollapsed()).toBe(true);
        expect(selection.anchor.key).toBe(afterCursor.getKey());
        expect(selection.anchor.offset).toBe(0);
      });
  });

  it('walks a mixed Artifact/CodeMirror Hole run one block at a time', async () => {
    const mixedEditor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      ArtifactPlugin,
      CodemirrorPlugin,
    ]);
    mixedEditor.initHeadlessEditor();
    mixedEditor.setDocument(
      'json',
      documentWith(paragraph('above'), artifact, codeBlock, artifact, paragraph('below')),
    );
    await moment();

    const lexical = mixedEditor.getLexicalEditor()!;
    const dispatchVertical = (direction: 'up' | 'down') => {
      const event = new KeyboardEvent('keydown', {
        cancelable: true,
        key: direction === 'up' ? 'ArrowUp' : 'ArrowDown',
      });
      lexical.dispatchCommand(
        direction === 'up' ? KEY_ARROW_UP_COMMAND : KEY_ARROW_DOWN_COMMAND,
        event,
      );
      return event;
    };

    const selectBoundary = (index: number, side: 'before' | 'after') => {
      lexical.update(
        () => {
          const hole = $nodesOfType(HoleNode)[index];
          const cursor = side === 'before' ? hole?.getBeforeCursor() : hole?.getAfterCursor();
          if (!cursor) throw new Error('Mixed Hole boundary missing');
          if (side === 'before') cursor.selectEnd();
          else cursor.selectStart();
        },
        { discrete: true },
      );
    };

    selectBoundary(0, 'after');
    expect(dispatchVertical('down').defaultPrevented).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      const holes = $nodesOfType(HoleNode);
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.key).toBe(holes[1]?.getBeforeCursor()?.getKey());
      expect(selection.anchor.offset).toBe(1);
    });

    selectBoundary(1, 'before');
    expect(dispatchVertical('down').defaultPrevented).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      const holes = $nodesOfType(HoleNode);
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.key).toBe(holes[2]?.getBeforeCursor()?.getKey());
      expect(selection.anchor.offset).toBe(1);
    });

    mixedEditor.destroy();
  });

  it('moves a single Hole NodeSelection vertically and stays stable at document endpoints', async () => {
    const lexical = editor.getLexicalEditor()!;
    editor.setDocument('json', documentWith(paragraph('before'), artifact, paragraph('after')));
    await moment();

    const selectHoleNode = () => {
      lexical.update(
        () => {
          const hole = $nodesOfType(HoleNode)[0];
          if (!hole) throw new Error('Hole missing');
          const selection = $createNodeSelection();
          selection.add(hole.getKey());
          $setSelection(selection);
        },
        { discrete: true },
      );
    };

    selectHoleNode();
    const up = dispatchVerticalArrow('up');
    expect(up.defaultPrevented).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.getNode().getTextContent()).toBe('before');
      expect(selection.anchor.offset).toBe('before'.length);
    });

    selectHoleNode();
    const down = dispatchVerticalArrow('down');
    expect(down.defaultPrevented).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.getNode().getTextContent()).toBe('after');
      expect(selection.anchor.offset).toBe(0);
    });

    editor.setDocument('json', documentWith(artifact));
    await moment();
    selectHoleNode();
    const endpoint = dispatchVerticalArrow('up');
    expect(endpoint.defaultPrevented).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isNodeSelection(selection)).toBe(true);
      if (!$isNodeSelection(selection)) throw new Error('Node selection missing');
      expect(selection.getNodes()).toHaveLength(1);
      expect(selection.getNodes()[0]).toBeInstanceOf(HoleNode);
    });
  });

  it('uses direct TextNode edges around a Hole inside a ListItem', async () => {
    const listEditor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      ArtifactPlugin,
      ListPlugin,
    ]);
    listEditor.initNodeEditor();
    const lexical = listEditor.getLexicalEditor()!;
    listEditor.setDocument(
      'json',
      documentWith({
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'left',
                type: 'text',
                version: 1,
              },
              artifact,
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'right',
                type: 'text',
                version: 1,
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'listitem',
            value: 1,
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        listType: 'bullet',
        start: 1,
        tag: 'ul',
        type: 'list',
        version: 1,
      }),
    );
    await moment();

    const selectBoundary = (side: 'before' | 'after') => {
      lexical.update(
        () => {
          const hole = $nodesOfType(HoleNode)[0];
          const cursor = side === 'before' ? hole?.getBeforeCursor() : hole?.getAfterCursor();
          if (!cursor) throw new Error('List Hole boundary missing');
          if (side === 'before') cursor.selectEnd();
          else cursor.selectStart();
        },
        { discrete: true },
      );
    };

    selectBoundary('before');
    const down = new KeyboardEvent('keydown', { cancelable: true, key: 'ArrowDown' });
    expect(lexical.dispatchCommand(KEY_ARROW_DOWN_COMMAND, down)).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.getNode().getTextContent()).toBe('right');
      expect(selection.anchor.offset).toBe(0);
    });

    selectBoundary('after');
    const up = new KeyboardEvent('keydown', { cancelable: true, key: 'ArrowUp' });
    expect(lexical.dispatchCommand(KEY_ARROW_UP_COMMAND, up)).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.getNode().getTextContent()).toBe('left');
      expect(selection.anchor.offset).toBe('left'.length);
    });

    listEditor.destroy();
  });

  it('keeps TableCell navigation local and yields its endpoint to the table owner', async () => {
    const tableEditor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      ArtifactPlugin,
      TablePlugin,
    ]);
    tableEditor.initHeadlessEditor();
    const lexical = tableEditor.getLexicalEditor()!;

    const createTableWith = (withText: boolean) => {
      lexical.update(
        () => {
          const table = $createTableNodeWithDimensions(1, 1, false);
          const row = table.getFirstChildOrThrow<TableRowNode>();
          const cell = row.getFirstChildOrThrow<TableCellNode>();
          cell.clear();
          if (withText) {
            cell.append(
              $createParagraphNode().append($createTextNode('cell-left')),
              $createArtifactNode('<main>cell</main>', 'Cell card'),
              $createParagraphNode().append($createTextNode('cell-right')),
            );
          } else {
            cell.append($createArtifactNode('<main>cell</main>', 'Cell card'));
          }
          $getRoot().append(table);
        },
        { discrete: true },
      );
    };

    const selectBoundary = (side: 'before' | 'after') => {
      lexical.update(
        () => {
          const artifactNode = $nodesOfType(ArtifactNode)[0];
          const hole = artifactNode?.getParent();
          if (!$isHoleNode(hole)) throw new Error('Artifact Hole missing');
          const cursor = side === 'before' ? hole?.getBeforeCursor() : hole?.getAfterCursor();
          if (!cursor) throw new Error('TableCell Hole boundary missing');
          if (side === 'before') cursor.selectEnd();
          else cursor.selectStart();
        },
        { discrete: true },
      );
    };

    createTableWith(true);
    await moment();
    selectBoundary('before');
    const down = new KeyboardEvent('keydown', { cancelable: true, key: 'ArrowDown' });
    expect(lexical.dispatchCommand(KEY_ARROW_DOWN_COMMAND, down)).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.getNode().getTextContent()).toBe('cell-right');
      expect(selection.anchor.offset).toBe(0);
    });

    tableEditor.setDocument('json', documentWith(paragraph('reset')));
    lexical.update(
      () => {
        const table = $createTableNodeWithDimensions(2, 2, false);
        const lastRow = table.getLastChildOrThrow<TableRowNode>();
        const lastCell = lastRow.getLastChildOrThrow<TableCellNode>();
        lastCell.clear();
        lastCell.append($createArtifactNode('<main>cell-end</main>', 'Cell end card'));
        const root = $getRoot();
        root.clear();
        root.append(table, $createParagraphNode().append($createTextNode('after-table')));
      },
      { discrete: true },
    );
    await moment();
    selectBoundary('after');
    const endpoint = new KeyboardEvent('keydown', { cancelable: true, key: 'ArrowDown' });
    lexical.dispatchCommand(KEY_ARROW_DOWN_COMMAND, endpoint);
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.getNode().getTextContent()).not.toBe('after-table');
    });
    tableEditor.destroy();
  });

  it.each([
    { name: 'alt', options: { altKey: true } },
    { name: 'control', options: { ctrlKey: true } },
    { name: 'meta', options: { metaKey: true } },
    { name: 'composition', options: { isComposing: true } },
  ])('passes $name horizontal navigation through the shared owners', async ({ options }) => {
    const lexical = editor.getLexicalEditor()!;
    selectBoundary('before');
    const boundary = lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      return { key: selection.anchor.key, offset: selection.anchor.offset };
    });
    const event = new KeyboardEvent('keydown', {
      cancelable: true,
      key: 'ArrowRight',
      ...options,
    });
    lexical.dispatchCommand(KEY_ARROW_RIGHT_COMMAND, event);
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.key).toBe(boundary.key);
      expect(selection.anchor.offset).toBe(boundary.offset);
    });

    lexical.setEditable(false);
    selectBoundary('before');
    const readonlyEvent = new KeyboardEvent('keydown', {
      cancelable: true,
      key: 'ArrowRight',
    });
    lexical.dispatchCommand(KEY_ARROW_RIGHT_COMMAND, readonlyEvent);
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
    });
    lexical.setEditable(true);
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
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole || !$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.isCollapsed()).toBe(false);
        expect(selection.anchor.key).toBe(hole.getBeforeCursor()?.getKey());
        expect(selection.focus.key).toBe(hole.getAfterCursor()?.getKey());
      });

    selectBoundary('after');
    dispatchArrow('left', true);
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole || !$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.isCollapsed()).toBe(false);
        expect(selection.anchor.key).toBe(hole.getAfterCursor()?.getKey());
        expect(selection.focus.key).toBe(hole.getBeforeCursor()?.getKey());
      });
  });

  it('keeps the Shift anchor while repeatedly crossing a Hole in both directions', async () => {
    const lexicalEditor = editor.getLexicalEditor()!;
    selectBoundary('before');

    dispatchArrow('right', true);
    await moment();
    const { beforeKey, afterKey } = lexicalEditor.getEditorState().read(() => {
      const hole = $nodesOfType(HoleNode)[0];
      if (!hole) throw new Error('Hole missing');
      return {
        afterKey: hole.getAfterCursor()?.getKey(),
        beforeKey: hole.getBeforeCursor()?.getKey(),
      };
    });
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.isCollapsed()).toBe(false);
      expect(selection.anchor.key).toBe(beforeKey);
      expect(selection.focus.key).toBe(afterKey);
    });

    dispatchArrow('right', true);
    await moment();
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.key).toBe(beforeKey);
      expect(selection.focus.getNode().getTextContent()).toBe('after');
      expect(selection.focus.offset).toBe(0);
    });

    dispatchArrow('left', true);
    await moment();
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.key).toBe(beforeKey);
      expect(selection.focus.key).toBe(afterKey);
      expect(selection.focus.offset).toBe(0);
    });

    dispatchArrow('left', true);
    await moment();
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.key).toBe(beforeKey);
      expect(selection.focus.key).toBe(beforeKey);
      expect(selection.focus.offset).toBe(1);
    });

    dispatchArrow('left', true);
    await moment();
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.key).toBe(beforeKey);
      expect(selection.focus.getNode().getTextContent()).toBe('before');
      expect(selection.focus.offset).toBe('before'.length);
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

  it.each([
    { side: 'before' as const, direction: 'up' as const, expectedText: 'before', offset: 6 },
    { side: 'after' as const, direction: 'up' as const, expectedText: 'before', offset: 6 },
    { side: 'before' as const, direction: 'down' as const, expectedText: 'after', offset: 0 },
    { side: 'after' as const, direction: 'down' as const, expectedText: 'after', offset: 0 },
  ])(
    'moves from the $side boundary to the $direction editable paragraph',
    async ({ side, direction, expectedText, offset }) => {
      selectBoundary(side);
      const event = dispatchVerticalArrow(direction);
      expect(event.defaultPrevented).toBe(true);
      await moment();

      editor
        .getLexicalEditor()!
        .getEditorState()
        .read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
          expect(selection.isCollapsed()).toBe(true);
          expect(selection.anchor.getNode().getTextContent()).toBe(expectedText);
          expect(selection.anchor.offset).toBe(offset);
        });
    },
  );

  it.each([
    { side: 'before' as const, direction: 'up' as const },
    { side: 'before' as const, direction: 'down' as const },
    { side: 'after' as const, direction: 'up' as const },
    { side: 'after' as const, direction: 'down' as const },
  ])(
    'keeps a Hole boundary and document unchanged without a $direction neighbor',
    async ({ side, direction }) => {
      editor.setDocument('json', documentWith(artifact));
      await moment();
      selectBoundary(side);

      const boundary = editor
        .getLexicalEditor()!
        .getEditorState()
        .read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
          return { key: selection.anchor.key, offset: selection.anchor.offset };
        });
      const event = dispatchVerticalArrow(direction);
      expect(event.defaultPrevented).toBe(true);
      await moment();

      editor
        .getLexicalEditor()!
        .getEditorState()
        .read(() => {
          const selection = $getSelection();
          expect(
            $getRoot()
              .getChildren()
              .map((node) => node.getType()),
          ).toEqual(['hole']);
          if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
          expect(selection.anchor.key).toBe(boundary.key);
          expect(selection.anchor.offset).toBe(boundary.offset);
        });
    },
  );

  it('does not append a paragraph when a Hole is the final child of a quote', async () => {
    editor.setDocument(
      'json',
      documentWith({
        children: [paragraph('quoted'), artifact],
        direction: null,
        format: '',
        indent: 0,
        type: 'quote',
        version: 1,
      }),
    );
    await moment();
    const lexical = editor.getLexicalEditor()!;
    selectBoundary('after');
    await moment();

    const boundary = lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      return { key: selection.anchor.key, offset: selection.anchor.offset };
    });
    const event = dispatchVerticalArrow('down');
    expect(event.defaultPrevented).toBe(true);
    await moment();

    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(['quote']);
      const quote = $getRoot().getFirstChild();
      if (!$isElementNode(quote)) throw new Error('Quote missing');
      expect(quote.getChildren().map((node) => node.getType())).toEqual(['paragraph', 'hole']);
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.key).toBe(boundary.key);
      expect(selection.anchor.offset).toBe(boundary.offset);
    });
  });

  it('leaves modified vertical arrows to the normal selection handlers', async () => {
    selectBoundary('before');
    const boundary = editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
        return { key: selection.anchor.key, offset: selection.anchor.offset };
      });

    const event = dispatchVerticalArrow('down', { shiftKey: true });
    expect(event.defaultPrevented).toBe(true);
    await moment();

    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
        expect(selection.anchor.key).toBe(boundary.key);
        expect(selection.anchor.offset).toBe(boundary.offset);
      });
  });

  it('lets the content consumer own selection after accepting entry', async () => {
    const lexicalEditor = editor.getLexicalEditor()!;
    const artifactKey = lexicalEditor
      .getEditorState()
      .read(() => $nodesOfType(ArtifactNode)[0].getKey());
    const payloads: Array<{ from: 'after' | 'before'; key: string }> = [];
    const unregister = lexicalEditor.registerCommand(
      ENTER_HOLE_CONTENT_COMMAND,
      (payload) => {
        if (!payload.from) return false;
        payloads.push({ from: payload.from, key: payload.key });
        $setSelection(null);
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
      const hole = $nodesOfType(HoleNode)[0];
      expect($isRangeSelection(selection)).toBe(true);
      if (!$isRangeSelection(selection) || !hole) return;
      expect(selection.isCollapsed()).toBe(false);
      expect(selection.anchor.key).toBe(hole.getBeforeCursor()?.getKey());
      expect(selection.focus.key).toBe(hole.getAfterCursor()?.getKey());
    });

    selectBoundary('after');
    dispatchArrow('left', true);
    await moment();
    expect(payloads).toEqual([]);
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      const hole = $nodesOfType(HoleNode)[0];
      expect($isRangeSelection(selection)).toBe(true);
      if (!$isRangeSelection(selection) || !hole) return;
      expect(selection.isCollapsed()).toBe(false);
      expect(selection.anchor.key).toBe(hole.getAfterCursor()?.getKey());
      expect(selection.focus.key).toBe(hole.getBeforeCursor()?.getKey());
    });

    selectBoundary('before');
    dispatchArrow('right');
    await moment();
    expect(payloads).toEqual([{ from: 'before', key: artifactKey }]);
    lexicalEditor.getEditorState().read(() => {
      expect($getSelection()).toBeNull();
    });

    selectBoundary('after');
    dispatchArrow('left');
    await moment();
    expect(payloads).toEqual([
      { from: 'before', key: artifactKey },
      { from: 'after', key: artifactKey },
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
      expect(selection.isCollapsed()).toBe(false);
      expect(selection.anchor.key).toBe(hole.getAfterCursor()?.getKey());
      expect(selection.anchor.offset).toBe(0);
      expect(selection.focus.key).toBe(hole.getBeforeCursor()?.getKey());
      expect(selection.focus.offset).toBe(1);
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
    {
      side: 'after' as const,
      expectedText: 'after',
      expectedTypes: ['paragraph', 'hole', 'paragraph'],
    },
  ])(
    'owns Delete at the $side boundary without leaking runtime nodes',
    async ({ side, expectedText, expectedTypes }) => {
      selectBoundary(side);
      const event = new KeyboardEvent('keydown', {
        cancelable: true,
        key: 'Delete',
      });
      expect(editor.getLexicalEditor()!.dispatchCommand(KEY_DELETE_COMMAND, event)).toBe(true);
      expect(event.defaultPrevented).toBe(true);
      await moment();
      await moment();

      editor
        .getLexicalEditor()!
        .getEditorState()
        .read(() => {
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
    },
  );
});
