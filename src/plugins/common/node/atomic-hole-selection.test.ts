import type { TableCellNode, TableRowNode } from '@lexical/table';
import { $createTableNodeWithDimensions } from '@lexical/table';
import { createBinding, type Provider } from '@lexical/yjs';
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
  CONTROLLED_TEXT_INSERTION_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
} from 'lexical';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Doc } from 'yjs';

import Editor, { moment } from '@/editor-kernel';
import { ArtifactPlugin } from '@/plugins/artifact/plugin';
import { CommonPlugin } from '@/plugins/common/plugin';
import { $createBlockImageNode, BlockImageNode } from '@/plugins/image/node/block-image-node';
import { ImagePlugin } from '@/plugins/image/plugin';
import { TablePlugin } from '@/plugins/table';
import { syncCurrentEditorStateToYjs } from '@/plugins/yjs/plugin/utils/sync';
import { getRenderableAwarenessStates } from '@/plugins/yjs/react';
import {
  createRelativePositionForLexicalPoint,
  resolveRelativeSelectionPoints,
} from '@/plugins/yjs/relative-position';
import type { IEditor } from '@/types';

import {
  $getAtomicHolePointContext,
  $normalizeAtomicHoleRangeSelection,
} from './atomic-hole-selection';
import { $createHoleNode, HoleNode } from './hole';

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
        const artifact = hole.getContentChildren().find((node) => node.getType() === 'artifact');
        return {
          afterKey: hole.getAfterCursor()!.getKey(),
          artifactKey: artifact!.getKey(),
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

  it('maps root points beside a Hole to matching boundaries without folding a range', async () => {
    const lexical = editor.getLexicalEditor()!;
    const { beforeKey, afterKey, holeKey } = getHoleKeys();
    let normalized:
      | {
          anchor: { key: string; offset: number };
          focus: { key: string; offset: number };
        }
      | undefined;

    lexical.update(
      () => {
        const root = $getRoot();
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole) throw new Error('Hole missing');
        const index = hole.getIndexWithinParent();
        const selection = $createRangeSelection();
        selection.anchor.set(root.getKey(), index, 'element');
        selection.focus.set(root.getKey(), index + 1, 'element');
        expect($getAtomicHolePointContext(selection.anchor)).toMatchObject({ side: 'before' });
        expect($getAtomicHolePointContext(selection.anchor)?.hole.getKey()).toBe(holeKey);
        expect($getAtomicHolePointContext(selection.focus)).toMatchObject({ side: 'after' });
        expect($getAtomicHolePointContext(selection.focus)?.hole.getKey()).toBe(holeKey);
        const lastOffset = hole.getChildrenSize() - 1;
        expect(
          $getAtomicHolePointContext({ key: holeKey, offset: 0, type: 'element' }),
        ).toMatchObject({ side: 'before' });
        expect(
          $getAtomicHolePointContext({ key: holeKey, offset: 1, type: 'element' }),
        ).toMatchObject({ side: 'before' });
        expect(
          $getAtomicHolePointContext({ key: holeKey, offset: lastOffset, type: 'element' }),
        ).toMatchObject({ side: 'after' });
        expect(
          $getAtomicHolePointContext({
            key: holeKey,
            offset: hole.getChildrenSize(),
            type: 'element',
          }),
        ).toMatchObject({ side: 'after' });
        expect($normalizeAtomicHoleRangeSelection(selection)).toBe(true);
        normalized = {
          anchor: { key: selection.anchor.key, offset: selection.anchor.offset },
          focus: { key: selection.focus.key, offset: selection.focus.offset },
        };
      },
      { discrete: true },
    );
    await moment();
    await moment();

    expect(normalized).toEqual({
      anchor: { key: beforeKey, offset: 1 },
      focus: { key: afterKey, offset: 0 },
    });
  });

  it('returns Element payload selections to the content node while keeping Artifact atomic', async () => {
    const lexical = editor.getLexicalEditor()!;
    const { artifactKey, holeKey } = getHoleKeys();
    let textKey = '';

    lexical.update(
      () => {
        const paragraph = $createParagraphNode();
        const text = $createTextNode('editable payload');
        paragraph.append(text);
        const hole = $createHoleNode(paragraph);
        $getRoot().append(hole);
        textKey = text.getKey();

        const elementSelection = $createRangeSelection();
        elementSelection.anchor.set(textKey, 2, 'text');
        elementSelection.focus.set(textKey, 2, 'text');
        expect($getAtomicHolePointContext(elementSelection.anchor)).toBeNull();
        expect($normalizeAtomicHoleRangeSelection(elementSelection)).toBe(false);

        const artifactContext = $getAtomicHolePointContext({
          key: artifactKey,
          offset: 0,
          type: 'element',
        });
        expect(artifactContext?.hole.getKey()).toBe(holeKey);
        expect(artifactContext?.side).toBe('before');
        $setSelection(elementSelection);
      },
      { discrete: true },
    );
    await moment();

    expect(readRangeAnchor()).toEqual({ key: textKey, offset: 2 });
    expect(lexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'X')).toBe(true);
    await moment();

    expect(readRangeAnchor().key).toBe(textKey);
    expect(lexical.getEditorState().read(() => $getNodeByKey(textKey)?.getTextContent())).toBe(
      'edXitable payload',
    );
  });

  it('leaves a manually wrapped Table payload selection and input inside the Table', async () => {
    const tableEditor = Editor.createEditor().registerPlugins([CommonPlugin, TablePlugin]);
    tableEditor.initHeadlessEditor();
    const lexical = tableEditor.getLexicalEditor()!;
    let tableKey = '';
    let textKey = '';

    lexical.update(
      () => {
        const table = $createTableNodeWithDimensions(1, 1, false);
        const row = table.getFirstChildOrThrow<TableRowNode>();
        const cell = row.getFirstChildOrThrow<TableCellNode>();
        const paragraph = $createParagraphNode();
        const text = $createTextNode('table payload');
        paragraph.append(text);
        cell.clear();
        cell.append(paragraph);

        const hole = $createHoleNode(table);
        $getRoot().append(hole);
        tableKey = table.getKey();
        textKey = text.getKey();

        const selection = $createRangeSelection();
        selection.anchor.set(textKey, 2, 'text');
        selection.focus.set(textKey, 2, 'text');
        expect(
          $getAtomicHolePointContext({ key: tableKey, offset: 0, type: 'element' }),
        ).toBeNull();
        expect($getAtomicHolePointContext(selection.anchor)).toBeNull();
        expect($normalizeAtomicHoleRangeSelection(selection)).toBe(false);
        $setSelection(selection);
      },
      { discrete: true },
    );
    await moment();

    expect(
      lexical.getEditorState().read(() => ({
        anchorKey: $getSelection()?.getNodes()[0]?.getKey(),
        rootType: $getRoot().getFirstChild()?.getType(),
        text: $getNodeByKey(textKey)?.getTextContent(),
      })),
    ).toEqual({ anchorKey: textKey, rootType: 'hole', text: 'table payload' });

    expect(lexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'X')).toBe(true);
    await moment();
    expect(lexical.getEditorState().read(() => $getNodeByKey(textKey)?.getTextContent())).toBe(
      'taXble payload',
    );
    expect(
      lexical.getEditorState().read(() => {
        const selection = $getSelection();
        return $isRangeSelection(selection) ? selection.anchor.key : null;
      }),
    ).toBe(textKey);
    tableEditor.destroy();
  });

  it('keeps a direct BlockImage decorator payload on its Hole boundary', async () => {
    const imageEditor = Editor.createEditor().registerPlugins([CommonPlugin, ImagePlugin]);
    imageEditor.initHeadlessEditor();
    const lexical = imageEditor.getLexicalEditor()!;
    let imageKey = '';
    let holeKey = '';

    lexical.update(
      () => {
        const image = $createBlockImageNode({
          altText: 'decorator',
          maxWidth: 640,
          src: 'https://example.com/decorator.png',
          width: 320,
        });
        const hole = $createHoleNode(image);
        $getRoot().append(hole);
        imageKey = image.getKey();
        holeKey = hole.getKey();

        const imageContext = $getAtomicHolePointContext({
          key: imageKey,
          offset: 0,
          type: 'element',
        });
        expect(imageContext?.hole.getKey()).toBe(holeKey);
        expect(imageContext?.side).toBe('before');
      },
      { discrete: true },
    );
    await moment();

    expect(lexical.getEditorState().read(() => $nodesOfType(BlockImageNode).length)).toBe(1);
    imageEditor.destroy();
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
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          buttons: 1,
          cancelable: true,
          clientX,
        }),
      );
      visual.dispatchEvent(
        new MouseEvent('pointerup', { bubbles: true, button: 0, buttons: 0, cancelable: true }),
      );
      visual.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX }));
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

    lexical.update(
      () => {
        const hole = $nodesOfType(HoleNode)[0];
        hole.getBeforeCursor()?.selectEnd();
      },
      { discrete: true },
    );
    const inputCompositionStart = new CompositionEvent('compositionstart', {
      bubbles: true,
      data: '',
    });
    input.dispatchEvent(inputCompositionStart);
    await moment();
    expect(
      lexical.getEditorState().read(() =>
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ),
    ).toEqual(['hole']);
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }));
    await moment();

    const iframe = document.createElement('iframe');
    iframe.dataset.holeInteractive = 'true';
    content.append(iframe);
    const iframePointer = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
    iframe.dispatchEvent(iframePointer);
    expect(iframePointer.defaultPrevented).toBe(false);
  });

  it("assigns a click in the Hole row whitespace to that row's after boundary", async () => {
    const lexical = editor.getLexicalEditor()!;
    const { artifactKey, holeKey } = getHoleKeys();
    const holeElement = root.querySelector<HTMLElement>('[data-hole="true"]');
    if (!holeElement) throw new Error('Hole DOM missing');
    // BlockPlugin exposes the payload as the logical id and the Hole as the
    // structural id. Boundary clicks must resolve the latter.
    holeElement.dataset.blockId = artifactKey;
    holeElement.dataset.structuralId = holeKey;
    vi.spyOn(holeElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 20));

    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 190,
      clientY: 10,
    });
    root.dispatchEvent(click);
    await moment();

    expect(click.defaultPrevented).toBe(true);
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      const hole = $nodesOfType(HoleNode)[0];
      if (!hole || !$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.isCollapsed()).toBe(true);
      expect(selection.anchor.key).toBe(hole.getAfterCursor()?.getKey());
      expect(selection.anchor.offset).toBe(0);
    });
  });

  it('does not redirect a drag that starts inside a composite Hole payload', async () => {
    const lexical = editor.getLexicalEditor()!;
    let textKey = '';
    lexical.update(
      () => {
        const hole = $nodesOfType(HoleNode)[0];
        const paragraph = $createParagraphNode();
        const text = $createTextNode('composite payload');
        paragraph.append(text);
        hole.getAfterCursor()?.insertBefore(paragraph);
        textKey = text.getKey();
        const selection = $createRangeSelection();
        selection.anchor.set(textKey, 2, 'text');
        selection.focus.set(textKey, 2, 'text');
        $setSelection(selection);
      },
      { discrete: true },
    );
    await moment();

    const textElement = lexical.getElementByKey(textKey);
    if (!textElement) throw new Error('Composite payload DOM missing');
    const pointerDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      buttons: 1,
      cancelable: true,
    });
    textElement.dispatchEvent(pointerDown);
    expect(pointerDown.defaultPrevented).toBe(false);
    textElement.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        button: 0,
        buttons: 1,
        cancelable: true,
      }),
    );
    textElement.dispatchEvent(
      new MouseEvent('pointerup', {
        bubbles: true,
        button: 0,
        buttons: 0,
        cancelable: true,
      }),
    );

    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.key).toBe(textKey);
      expect(selection.focus.key).toBe(textKey);
    });
  });

  it('keeps native drag selection alive when it starts on either Hole boundary hit area', async () => {
    const beforeHit = root.querySelector<HTMLElement>('[data-hole-cursor-hit="before"]');
    const afterHit = root.querySelector<HTMLElement>('[data-hole-cursor-hit="after"]');
    if (!beforeHit || !afterHit) throw new Error('Hole boundary hit areas missing');

    for (const hit of [beforeHit, afterHit]) {
      const pointerDown = new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        buttons: 1,
        cancelable: true,
        clientX: 12,
        clientY: 12,
      });
      hit.dispatchEvent(pointerDown);
      expect(pointerDown.defaultPrevented).toBe(false);

      const selectStart = new Event('selectstart', { bubbles: true, cancelable: true });
      hit.dispatchEvent(selectStart);
      expect(selectStart.defaultPrevented).toBe(false);

      const pointerMove = new MouseEvent('pointermove', {
        bubbles: true,
        button: 0,
        buttons: 1,
        cancelable: true,
        clientX: 80,
        clientY: 20,
      });
      hit.dispatchEvent(pointerMove);

      const nativeSelection = document.getSelection();
      if (!nativeSelection) throw new Error('Native selection unavailable');
      nativeSelection.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(root);
      nativeSelection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      expect(nativeSelection.rangeCount).toBe(1);
      expect(nativeSelection.isCollapsed).toBe(false);

      hit.dispatchEvent(
        new MouseEvent('pointerup', {
          bubbles: true,
          button: 0,
          buttons: 0,
          cancelable: true,
        }),
      );
      await moment();
    }
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
