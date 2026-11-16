import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $nodesOfType,
  $setSelection,
  COMPOSITION_END_COMMAND,
  COMPOSITION_START_COMMAND,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  type LexicalEditor,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { $isArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { ArtifactPlugin } from '@/plugins/artifact/plugin';
import { CommonPlugin } from '@/plugins/common/plugin';
import type { IEditor } from '@/types';

import { HoleNode } from './hole';

const artifactDocument = {
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

describe('Hole boundary native input', () => {
  let editor: IEditor;
  let root: HTMLDivElement;
  const rangePrototype = Range.prototype as Range & { getBoundingClientRect?: () => DOMRect };
  const originalRangeGetBoundingClientRect = rangePrototype.getBoundingClientRect;

  beforeEach(() => {
    if (!rangePrototype.getBoundingClientRect) {
      Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: () => new DOMRect(),
      });
    }
  });

  afterEach(() => {
    editor?.destroy();
    root?.remove();
    if (originalRangeGetBoundingClientRect) {
      Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: originalRangeGetBoundingClientRect,
      });
    } else {
      Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
    }
  });

  const createEditor = async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, ArtifactPlugin]);
    root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    document.body.append(root);
    const lexical = editor.setRootElement(root);
    editor.setDocument('json', artifactDocument);
    await moment();
    await moment();
    return lexical;
  };

  const setNativeCaret = (textNode: Text, offset: number): void => {
    const selection = document.getSelection();
    if (!selection) throw new Error('Native selection unavailable');
    selection.removeAllRanges();
    const range = document.createRange();
    range.setStart(textNode, offset);
    range.setEnd(textNode, offset);
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  };

  const selectBoundary = async (lexical: LexicalEditor, side: 'before' | 'after') => {
    const hit = root.querySelector<HTMLElement>(`[data-hole-cursor-hit="${side}"]`);
    if (!hit) throw new Error(`${side} boundary hit area missing`);
    hit.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        buttons: 1,
        cancelable: true,
      }),
    );
    hit.dispatchEvent(
      new MouseEvent('pointerup', { bubbles: true, button: 0, buttons: 0, cancelable: true }),
    );
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }));
    await moment();
    await moment();
    const cursorKey = lexical.getEditorState().read(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = side === 'before' ? hole.getBeforeCursor() : hole.getAfterCursor();
      if (!cursor) throw new Error(`${side} boundary cursor missing`);
      return cursor.getKey();
    });
    const cursorElement = lexical.getElementByKey(cursorKey);
    if (!cursorElement) throw new Error(`${side} boundary cursor DOM missing`);
    const cursorText = cursorElement.firstChild;
    if (!(cursorText instanceof Text)) throw new Error(`${side} boundary cursor text missing`);
    setNativeCaret(cursorText, side === 'before' ? 1 : 0);
    return { cursorElement, cursorText };
  };

  const expectArtifactIntact = (lexical: LexicalEditor) => {
    lexical.getEditorState().read(() => {
      const artifact = $nodesOfType(HoleNode)[0]?.getContentChildren().find($isArtifactNode);
      expect(artifact && $isArtifactNode(artifact) ? artifact.getHtml() : null).toBe(
        '<main>Atomic content</main>',
      );
      expect(artifact && $isArtifactNode(artifact) ? artifact.getTitle() : null).toBe(
        'Atomic artifact',
      );
    });
  };

  const dispatchNativeTextInput = (cursorText: Text, data: string): void => {
    const beforeInput = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      data,
      inputType: 'insertText',
    });
    root.dispatchEvent(beforeInput);
    if (beforeInput.defaultPrevented) return;
    cursorText.data = `${cursorText.data}${data}`;
    setNativeCaret(cursorText, cursorText.data.length);
    root.dispatchEvent(new InputEvent('input', { bubbles: true, data, inputType: 'insertText' }));
  };

  it('moves native before-boundary text into a paragraph above the Artifact Hole', async () => {
    const lexical = await createEditor();
    const { cursorText } = await selectBoundary(lexical, 'before');
    dispatchNativeTextInput(cursorText, 'front input');
    await moment();
    await moment();

    lexical.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children.map((node) => node.getType())).toEqual(['paragraph', 'hole']);
      expect(children[0]?.getTextContent()).toBe('front input');
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if ($isRangeSelection(selection)) {
        expect(selection.isCollapsed()).toBe(true);
        expect(selection.anchor.getNode().getParent()?.getType()).toBe('paragraph');
        expect(selection.anchor.getNode().getTextContent()).toBe('front input');
        expect(selection.anchor.offset).toBe('front input'.length);
      }
    });
    expectArtifactIntact(lexical);
  });

  it('undoes and redoes the paragraph created by native boundary input', async () => {
    const lexical = await createEditor();
    const { cursorText } = await selectBoundary(lexical, 'before');
    dispatchNativeTextInput(cursorText, 'u');
    await moment();
    await moment();

    expect(
      lexical.getEditorState().read(() =>
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ),
    ).toEqual(['paragraph', 'hole']);
    expect(lexical.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await moment();
    expect(
      lexical.getEditorState().read(() =>
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ),
    ).toEqual(['hole']);
    expectArtifactIntact(lexical);

    expect(lexical.dispatchCommand(REDO_COMMAND, undefined)).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children.map((node) => node.getType())).toEqual(['paragraph', 'hole']);
      expect(children[0]?.getTextContent()).toBe('u');
    });
    expectArtifactIntact(lexical);
  });

  it('routes a controlled single-character input at the after boundary below the Artifact Hole', async () => {
    const lexical = await createEditor();
    await selectBoundary(lexical, 'after');

    expect(lexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'd')).toBe(true);
    await moment();
    await moment();

    lexical.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children.map((node) => node.getType())).toEqual(['hole', 'paragraph']);
      expect(children[1]?.getTextContent()).toBe('d');
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if ($isRangeSelection(selection)) {
        expect(selection.isCollapsed()).toBe(true);
        expect(selection.anchor.getNode().getParent()?.getType()).toBe('paragraph');
        expect(selection.anchor.offset).toBe(1);
      }
    });
    expectArtifactIntact(lexical);
  });

  it.each(['before', 'after'] as const)(
    'starts Chinese IME on the %s sibling paragraph and keeps the Artifact Hole atomic',
    async (side) => {
      const lexical = await createEditor();
      const { cursorElement } = await selectBoundary(lexical, side);

      root.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      await moment();
      lexical.getEditorState().read(() => {
        expect(
          $getRoot()
            .getChildren()
            .map((node) => node.getType()),
        ).toEqual(side === 'before' ? ['paragraph', 'hole'] : ['hole', 'paragraph']);
      });

      let compositionKey = '';
      let compositionOffset = 0;
      lexical.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('IME selection missing');
        compositionKey = selection.anchor.key;
        compositionOffset = selection.anchor.offset;
      });
      const compositionElement = lexical.getElementByKey(compositionKey);
      if (!compositionElement || compositionElement === cursorElement) {
        throw new Error('IME did not move to the new paragraph');
      }
      const compositionText = compositionElement.firstChild;
      if (!(compositionText instanceof Text)) throw new Error('IME paragraph text missing');
      setNativeCaret(compositionText, compositionOffset);

      const beforeInput = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        data: '简介',
        inputType: 'insertCompositionText',
      });
      root.dispatchEvent(beforeInput);
      if (!beforeInput.defaultPrevented) {
        compositionText.data = `${compositionText.data.slice(0, compositionOffset)}简介${compositionText.data.slice(compositionOffset)}`;
        setNativeCaret(compositionText, compositionOffset + 2);
        root.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            data: '简介',
            inputType: 'insertCompositionText',
          }),
        );
      }
      await moment();
      root.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '简介' }));
      await moment();
      await moment();
      await moment();

      lexical.getEditorState().read(() => {
        const children = $getRoot().getChildren();
        expect(children.map((node) => node.getType())).toEqual(
          side === 'before' ? ['paragraph', 'hole'] : ['hole', 'paragraph'],
        );
        expect(
          side === 'before' ? children[0]?.getTextContent() : children[1]?.getTextContent(),
        ).toBe('简介');
        const selection = $getSelection();
        expect($isRangeSelection(selection)).toBe(true);
        if ($isRangeSelection(selection)) {
          expect(selection.isCollapsed()).toBe(true);
          expect(selection.anchor.getNode().getParent()?.getType()).toBe('paragraph');
          expect(selection.anchor.getNode().getTextContent()).toBe('简介');
          expect(selection.anchor.offset).toBe('简介'.length);
        }
      });
      expect(lexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'abc')).toBe(true);
      await moment();
      lexical.getEditorState().read(() => {
        const children = $getRoot().getChildren();
        const paragraph = side === 'before' ? children[0] : children[1];
        expect(paragraph?.getTextContent()).toBe('简介abc');
      });
      expect(lexical.isComposing()).toBe(false);
      expectArtifactIntact(lexical);
    },
  );

  it('preserves pending boundary text when composition starts after a DOM/model delay', async () => {
    const lexical = await createEditor();
    lexical.update(
      () => {
        const hole = $nodesOfType(HoleNode)[0];
        const cursor = hole.getBeforeCursor();
        if (!cursor) throw new Error('before boundary cursor missing');
        cursor.setTextContent('\uFEFFpending');
        cursor.selectEnd();
        lexical.dispatchCommand(
          COMPOSITION_START_COMMAND,
          new CompositionEvent('compositionstart', { data: '' }),
        );
      },
      { discrete: true },
    );
    await moment();

    lexical.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children.map((node) => node.getType())).toEqual(['paragraph', 'hole']);
      expect(children[0]?.getTextContent()).toBe('pending');
    });
    lexical.dispatchCommand(
      COMPOSITION_END_COMMAND,
      new CompositionEvent('compositionend', { data: '' }),
    );
    await moment();
    expectArtifactIntact(lexical);
  });

  it('does not create another paragraph when composition starts in ordinary text', async () => {
    const lexical = await createEditor();
    let textKey = '';
    lexical.update(
      () => {
        const hole = $nodesOfType(HoleNode)[0];
        const paragraph = $createParagraphNode().append($createTextNode('ordinary'));
        hole.insertBefore(paragraph);
        const text = paragraph.getFirstChild();
        if (!text) throw new Error('ordinary text missing');
        textKey = text.getKey();
        const selection = $createRangeSelection();
        selection.anchor.set(textKey, text.getTextContentSize(), 'text');
        selection.focus.set(textKey, text.getTextContentSize(), 'text');
        $setSelection(selection);
      },
      { discrete: true },
    );
    await moment();

    const textElement = lexical.getElementByKey(textKey);
    if (!textElement || !(textElement.firstChild instanceof Text)) {
      throw new Error('ordinary text DOM missing');
    }
    setNativeCaret(textElement.firstChild, textElement.firstChild.data.length);
    root.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    await moment();

    lexical.getEditorState().read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(['paragraph', 'hole']);
      expect($getRoot().getFirstChild()?.getTextContent()).toBe('ordinary');
    });
    root.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }));
    expectArtifactIntact(lexical);
  });
});
