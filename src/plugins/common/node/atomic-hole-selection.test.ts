import {
  $createNodeSelection,
  $createRangeSelection,
  $createTextNode,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  $nodesOfType,
  $setSelection,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
} from 'lexical';
import { createBinding, type Provider } from '@lexical/yjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Doc } from 'yjs';

import Editor, { moment } from '@/editor-kernel';
import { ArtifactPlugin } from '@/plugins/artifact/plugin';
import { CommonPlugin } from '@/plugins/common/plugin';
import type { IEditor } from '@/types';
import {
  createRelativePositionForLexicalPoint,
  resolveRelativeSelectionPoints,
} from '@/plugins/yjs/relative-position';
import { getRenderableAwarenessStates } from '@/plugins/yjs/react';
import { syncCurrentEditorStateToYjs } from '@/plugins/yjs/plugin/utils/sync';

import { HoleNode } from './hole';

const documentWithArtifact = {
  root: {
    children: [
      {
        html: '<main>Atomic content</main>',
        title: 'Atomic artifact',
        type: 'artifact',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

describe('atomic Hole selection guard', () => {
  let editor: IEditor;
  let root: HTMLElement;

  beforeEach(async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, ArtifactPlugin]);
    editor.initNodeEditor();
    root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    editor.setRootElement(root);
    editor.setDocument('json', documentWithArtifact);
    await moment();
    editor.getLexicalEditor()!.update(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const after = hole.getAfterCursor();
      if (!after) throw new Error('Hole boundary cursor missing');
      after.insertBefore($createTextNode('payload content'));
    });
    await moment();
  });

  const getHoleKeys = () =>
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const hole = $nodesOfType(HoleNode)[0];
        const payload = hole.getContentChildren().find((node) => node.getType() === 'text');
        return {
          afterKey: hole.getAfterCursor()!.getKey(),
          beforeKey: hole.getBeforeCursor()!.getKey(),
          holeKey: hole.getKey(),
          payloadKey: payload!.getKey(),
        };
      });

  const readRangeAnchor = () =>
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
        return { key: selection.anchor.key, offset: selection.anchor.offset };
      });

  it('normalizes programmatic RangeSelection endpoints to a boundary but preserves NodeSelection', async () => {
    const lexical = editor.getLexicalEditor()!;
    const { holeKey, payloadKey } = getHoleKeys();

    lexical.update(() => {
      const selection = $createRangeSelection();
      selection.anchor.set(payloadKey, 2, 'text');
      selection.focus.set(payloadKey, 2, 'text');
      $setSelection(selection);
    });
    await moment();
    await moment();

    const normalizedKeys = getHoleKeys();
    expect(readRangeAnchor()).toEqual({ key: normalizedKeys.beforeKey, offset: 1 });

    lexical.update(() => {
      const selection = $createNodeSelection();
      selection.add(normalizedKeys.holeKey || holeKey);
      $setSelection(selection);
    });
    await moment();
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isNodeSelection(selection)).toBe(true);
      expect(selection?.getNodes()[0].getKey()).toBe(normalizedKeys.holeKey || holeKey);
    });
  });

  it('maps ArrowLeft/ArrowRight from payload content to before/after cursors', async () => {
    const lexical = editor.getLexicalEditor()!;
    const { payloadKey } = getHoleKeys();

    lexical.update(() => {
      const selection = $createRangeSelection();
      selection.anchor.set(payloadKey, 2, 'text');
      selection.focus.set(payloadKey, 2, 'text');
      $setSelection(selection);
    });
    const left = new KeyboardEvent('keydown', { cancelable: true, key: 'ArrowLeft' });
    expect(lexical.dispatchCommand(KEY_ARROW_LEFT_COMMAND, left)).toBe(true);
    expect(left.defaultPrevented).toBe(true);
    await moment();
    expect(readRangeAnchor()).toEqual({ key: getHoleKeys().beforeKey, offset: 1 });

    lexical.update(() => {
      const selection = $createRangeSelection();
      selection.anchor.set(payloadKey, 2, 'text');
      selection.focus.set(payloadKey, 2, 'text');
      $setSelection(selection);
    });
    const right = new KeyboardEvent('keydown', { cancelable: true, key: 'ArrowRight' });
    expect(lexical.dispatchCommand(KEY_ARROW_RIGHT_COMMAND, right)).toBe(true);
    expect(right.defaultPrevented).toBe(true);
    await moment();
    expect(readRangeAnchor()).toEqual({ key: getHoleKeys().afterKey, offset: 0 });
  });

  it('projects content clicks to the nearest before/after boundary and leaves internal inputs usable', async () => {
    const lexical = editor.getLexicalEditor()!;
    const dispatchContentPointer = async (clientX: number) => {
      const { holeKey } = getHoleKeys();
      const holeElement = root.querySelector<HTMLElement>('[data-hole="true"]');
      const content = root.querySelector<HTMLElement>('[data-hole-content="true"]');
      if (!holeElement || !content) throw new Error('Hole DOM missing');
      holeElement.dataset.blockId = holeKey;
      vi.spyOn(holeElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 10));
      const visual = document.createElement('span');
      content.replaceChildren(visual);
      visual.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX }),
      );
    };

    await dispatchContentPointer(0);
    await moment();
    expect(readRangeAnchor()).toEqual({ key: getHoleKeys().beforeKey, offset: 1 });

    await dispatchContentPointer(200);
    await moment();
    expect(readRangeAnchor()).toEqual({ key: getHoleKeys().afterKey, offset: 0 });

    const content = root.querySelector<HTMLElement>('[data-hole-content="true"]');
    if (!content) throw new Error('Hole content DOM missing');
    const input = document.createElement('input');
    content.append(input);
    const inputPointer = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
    input.dispatchEvent(inputPointer);
    expect(inputPointer.defaultPrevented).toBe(false);

    const iframe = document.createElement('iframe');
    iframe.dataset.holeInteractive = 'true';
    content.append(iframe);
    const iframePointer = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
    iframe.dispatchEvent(iframePointer);
    expect(iframePointer.defaultPrevented).toBe(false);
  });

  it('projects a remote awareness caret in Hole content to the boundary cursor', async () => {
    const lexical = editor.getLexicalEditor()!;
    const { payloadKey } = getHoleKeys();
    const doc = new Doc();
    const provider = {
      awareness: {
        getLocalState: () => null,
        getStates: () => new Map(),
        on: () => undefined,
        off: () => undefined,
      },
      connect: () => undefined,
      disconnect: () => undefined,
      on: () => undefined,
      off: () => undefined,
    } as unknown as Provider;
    const binding = createBinding(
      lexical,
      provider,
      'atomic-hole-room',
      doc,
      new Map([['atomic-hole-room', doc]]),
    );
    syncCurrentEditorStateToYjs(binding, provider);
    const position = lexical
      .getEditorState()
      .read(() =>
        createRelativePositionForLexicalPoint(
          { key: payloadKey, offset: 2, type: 'text' },
          binding,
        ),
      );
    if (!position) throw new Error('Remote test position missing');

    const state = {
      anchorPos: position,
      awarenessData: {},
      color: '#2563eb',
      focusPos: position,
      focusing: true,
      name: 'Remote user',
    } as never;
    const renderable = getRenderableAwarenessStates(binding, provider, new Map([[42, state]]));
    const normalized = renderable.get(42);
    if (!normalized?.anchorPos || !normalized.focusPos) {
      throw new Error('Remote awareness state missing positions');
    }
    const points = resolveRelativeSelectionPoints(
      binding,
      normalized.anchorPos,
      normalized.focusPos,
    );
    expect(points).toMatchObject({
      anchorKey: getHoleKeys().beforeKey,
      anchorOffset: 1,
      focusKey: getHoleKeys().beforeKey,
      focusOffset: 1,
    });
    binding.root.destroy(binding);
    doc.destroy();
  });
});
