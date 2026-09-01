import {
  $createNodeSelection,
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  $nodesOfType,
  $setSelection,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
} from 'lexical';
import { act, createElement, type FC } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { HoleNode } from '@/plugins/common/node/hole';
import type { IEditor } from '@/types';

import { INSERT_ARTIFACT_COMMAND } from '../command';
import { ArtifactNode } from '../node/ArtifactNode';
import { ArtifactPlugin } from '../plugin';
import { $getArtifactSelectionState, useArtifactSelectionState } from './selection';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const SelectionHarness: FC<{
  editor: ReturnType<IEditor['getLexicalEditor']>;
  nodeKey: string;
}> = ({ editor, nodeKey }) => {
  const selection = useArtifactSelectionState(editor!, nodeKey);
  return createElement('div', {
    'className': selection.covered ? 'artifact-selected' : undefined,
    'data-testid': 'selection-state',
  });
};

describe('Artifact selection coverage', () => {
  let editor: IEditor;

  beforeEach(async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, ArtifactPlugin]);
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
      html: '<main>selection</main>',
      title: 'Selection',
    });
    await moment();
  });

  afterEach(() => editor.destroy());

  it('tracks direct node, parent Hole, select-all, cross-block range, and selection exit', () => {
    const lexicalEditor = editor.getLexicalEditor()!;
    lexicalEditor.update(() => {
      const artifact = $nodesOfType(ArtifactNode)[0];
      const hole = $nodesOfType(HoleNode)[0];
      if (!artifact || !hole) throw new Error('Artifact Hole missing');

      const direct = $createNodeSelection();
      direct.add(artifact.getKey());
      $setSelection(direct);
      expect($getArtifactSelectionState(artifact.getKey())).toEqual({
        covered: true,
        directNodeSelection: true,
      });

      const parentSelection = $createNodeSelection();
      parentSelection.add(hole.getKey());
      $setSelection(parentSelection);
      expect($getArtifactSelectionState(artifact.getKey())).toEqual({
        covered: true,
        directNodeSelection: false,
      });

      hole.getBeforeCursor()?.selectEnd();
      expect($getArtifactSelectionState(artifact.getKey())).toEqual({
        covered: false,
        directNodeSelection: false,
      });
      hole.getAfterCursor()?.selectStart();
      expect($getArtifactSelectionState(artifact.getKey())).toEqual({
        covered: false,
        directNodeSelection: false,
      });

      const before = $createParagraphNode().append($createTextNode('before'));
      const after = $createParagraphNode().append($createTextNode('after'));
      hole.insertBefore(before);
      hole.insertAfter(after);

      const crossBlock = $createRangeSelection();
      crossBlock.setTextNodeRange(before.getFirstChild()!, 0, after.getFirstChild()!, 5);
      $setSelection(crossBlock);
      expect($getArtifactSelectionState(artifact.getKey())).toEqual({
        covered: true,
        directNodeSelection: false,
      });

      const selectAll = $createRangeSelection();
      selectAll.anchor.set('root', 0, 'element');
      selectAll.focus.set('root', $getRoot().getChildrenSize(), 'element');
      $setSelection(selectAll);
      expect($getArtifactSelectionState(artifact.getKey()).covered).toBe(true);

      after.selectEnd();
      expect($getArtifactSelectionState(artifact.getKey())).toEqual({
        covered: false,
        directNodeSelection: false,
      });
    });
  });

  it('removes the React selected class after either gutter click and keeps range coverage strict', async () => {
    const lexicalEditor = editor.getLexicalEditor()!;
    const editorRoot = document.createElement('div');
    editorRoot.setAttribute('contenteditable', 'true');
    document.body.append(editorRoot);
    editor.setRootElement(editorRoot);
    const artifactKey = lexicalEditor
      .getEditorState()
      .read(() => $nodesOfType(ArtifactNode)[0].getKey());
    const host = document.createElement('div');
    document.body.append(host);
    const reactRoot = createRoot(host);

    const selectArtifact = () => {
      lexicalEditor.update(
        () => {
          const selection = $createNodeSelection();
          selection.add(artifactKey);
          $setSelection(selection);
        },
        { discrete: true },
      );
    };

    await act(async () => {
      reactRoot.render(
        createElement(SelectionHarness, { editor: lexicalEditor, nodeKey: artifactKey }),
      );
    });
    await act(async () => {
      selectArtifact();
      await moment();
    });
    expect(host.firstElementChild?.classList).toContain('artifact-selected');
    expect(window.getSelection()?.rangeCount ?? 0).toBe(0);

    for (const side of ['before', 'after'] as const) {
      if (side === 'after') {
        await act(async () => {
          selectArtifact();
          await moment();
        });
      }
      const hit = editorRoot.querySelector<HTMLElement>(`[data-hole-cursor-hit="${side}"]`);
      if (!hit) throw new Error('Hole hit area missing');
      await act(async () => {
        hit.dispatchEvent(
          new MouseEvent('pointerdown', { bubbles: true, button: 0, cancelable: true }),
        );
        await moment();
      });
      expect(host.firstElementChild?.classList).not.toContain('artifact-selected');
      lexicalEditor.getEditorState().read(() => {
        const selection = $getSelection();
        expect($isRangeSelection(selection) && selection.isCollapsed()).toBe(true);
      });
    }

    let afterParagraphKey = '';
    await act(async () => {
      lexicalEditor.update(
        () => {
          const before = $createTextNode('before');
          const after = $createTextNode('after');
          const hole = $nodesOfType(HoleNode)[0];
          hole.insertBefore($createParagraphNode().append(before));
          const afterParagraph = $createParagraphNode().append(after);
          afterParagraphKey = afterParagraph.getKey();
          hole.insertAfter(afterParagraph);
          const range = $createRangeSelection();
          range.setTextNodeRange(before, 0, after, after.getTextContentSize());
          $setSelection(range);
        },
        { discrete: true },
      );
      await moment();
    });
    expect(host.firstElementChild?.classList).toContain('artifact-selected');

    await act(async () => {
      lexicalEditor.update(
        () => {
          const afterParagraph = $getNodeByKey(afterParagraphKey);
          if (!afterParagraph) throw new Error('after paragraph missing');
          const selection = $createNodeSelection();
          selection.add(afterParagraph.getKey());
          $setSelection(selection);
        },
        { discrete: true },
      );
      await moment();
    });
    expect(host.firstElementChild?.classList).not.toContain('artifact-selected');

    await act(async () => {
      const beforeHit = editorRoot.querySelector<HTMLElement>('[data-hole-cursor-hit="before"]');
      beforeHit?.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0, cancelable: true }),
      );
      lexicalEditor.dispatchCommand(
        KEY_ARROW_LEFT_COMMAND,
        new KeyboardEvent('keydown', { cancelable: true, key: 'ArrowLeft' }),
      );
      await moment();
    });
    expect(host.firstElementChild?.classList).not.toContain('artifact-selected');

    await act(async () => reactRoot.unmount());
    host.remove();
    editorRoot.remove();
  });

  it('keeps plain Hole traversal unselected but shows the class for Shift traversal', async () => {
    const lexicalEditor = editor.getLexicalEditor()!;
    const artifactKey = lexicalEditor
      .getEditorState()
      .read(() => $nodesOfType(ArtifactNode)[0].getKey());
    const host = document.createElement('div');
    document.body.append(host);
    const reactRoot = createRoot(host);

    const setBoundary = (side: 'before' | 'after') => {
      lexicalEditor.update(
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
    const arrow = (direction: 'left' | 'right', shiftKey = false) => {
      const event = new KeyboardEvent('keydown', {
        cancelable: true,
        key: direction === 'left' ? 'ArrowLeft' : 'ArrowRight',
        shiftKey,
      });
      const command = direction === 'left' ? KEY_ARROW_LEFT_COMMAND : KEY_ARROW_RIGHT_COMMAND;
      expect(lexicalEditor.dispatchCommand(command, event)).toBe(true);
      expect(event.defaultPrevented).toBe(true);
    };

    await act(async () => {
      reactRoot.render(
        createElement(SelectionHarness, { editor: lexicalEditor, nodeKey: artifactKey }),
      );
      await moment();
    });

    await act(async () => {
      setBoundary('before');
      arrow('right');
      await moment();
    });
    expect(host.firstElementChild?.classList).not.toContain('artifact-selected');
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection) && selection.isCollapsed()).toBe(true);
    });

    await act(async () => {
      setBoundary('after');
      arrow('left');
      await moment();
    });
    expect(host.firstElementChild?.classList).not.toContain('artifact-selected');
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection) && selection.isCollapsed()).toBe(true);
    });

    await act(async () => {
      setBoundary('before');
      arrow('right', true);
      await moment();
    });
    expect(host.firstElementChild?.classList).toContain('artifact-selected');
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isNodeSelection(selection)).toBe(true);
      expect(selection?.getNodes()[0]).toBeInstanceOf(ArtifactNode);
    });

    await act(async () => {
      arrow('right');
      await moment();
    });
    expect(host.firstElementChild?.classList).not.toContain('artifact-selected');
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      const hole = $nodesOfType(HoleNode)[0];
      if (!hole || !$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.isCollapsed()).toBe(true);
      expect(selection.anchor.key).toBe(hole.getAfterCursor()?.getKey());
    });

    await act(async () => {
      setBoundary('after');
      arrow('left', true);
      await moment();
    });
    expect(host.firstElementChild?.classList).toContain('artifact-selected');
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isNodeSelection(selection)).toBe(true);
      expect(selection?.getNodes()[0]).toBeInstanceOf(ArtifactNode);
    });

    await act(async () => {
      arrow('left');
      await moment();
    });
    expect(host.firstElementChild?.classList).not.toContain('artifact-selected');
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      const hole = $nodesOfType(HoleNode)[0];
      if (!hole || !$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.isCollapsed()).toBe(true);
      expect(selection.anchor.key).toBe(hole.getBeforeCursor()?.getKey());
    });

    await act(async () => reactRoot.unmount());
    host.remove();
  });
});
