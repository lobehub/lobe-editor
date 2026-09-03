import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $nodesOfType,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common/plugin';
import type { IEditor } from '@/types';

import { styles } from '../react/style';
import { $createHoleNode, HoleNode } from './hole';

describe('HoleNode DOM layout', () => {
  let editor: IEditor | null = null;

  afterEach(() => {
    editor?.destroy();
    editor = null;
    document.body.replaceChildren();
  });

  it('renders real boundary cursors in left/content/right columns and selects them', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    const wrapper = document.createElement('div');
    wrapper.className = styles.root;
    const rootElement = document.createElement('div');
    rootElement.setAttribute('contenteditable', 'true');
    wrapper.append(rootElement);
    document.body.append(wrapper);
    const lexicalEditor = editor.setRootElement(rootElement);

    lexicalEditor.update(() => {
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode('payload'));
      $getRoot().append($createHoleNode(paragraph));
    });
    await moment();

    const holeElement = rootElement.querySelector<HTMLElement>('[data-hole="true"]');
    const contentElement = holeElement?.querySelector<HTMLElement>(
      ':scope > [data-hole-content="true"]',
    );
    if (!holeElement || !contentElement) throw new Error('Hole DOM missing');

    expect(holeElement.dataset.holeLayout).toBe('outside-boundary');
    expect(contentElement.children).toHaveLength(3);
    expect(contentElement.firstElementChild?.getAttribute('data-lexical-text')).toBe('true');
    expect(contentElement.lastElementChild?.getAttribute('data-lexical-text')).toBe('true');
    expect(contentElement.children[1].textContent).toBe('payload');
    expect(getComputedStyle(contentElement).display).toBe('block');
    expect(getComputedStyle(contentElement).width).toBe('100%');
    expect(getComputedStyle(contentElement).gridTemplateColumns).toBe('none');
    expect(getComputedStyle(contentElement.children[1]).minWidth).toBe('0px');
    const beforeCursorStyle = getComputedStyle(contentElement.firstElementChild!);
    const afterCursorStyle = getComputedStyle(contentElement.lastElementChild!);
    expect(beforeCursorStyle.cursor).toBe('text');
    expect(beforeCursorStyle.display).toBe('block');
    expect(beforeCursorStyle.position).toBe('absolute');
    expect(beforeCursorStyle.insetBlockEnd).toBe('8px');
    expect(beforeCursorStyle.insetInlineEnd).toBe('100%');
    expect(beforeCursorStyle.height).toBe('1em');
    expect(beforeCursorStyle.overflow).toBe('visible');
    expect(beforeCursorStyle.pointerEvents).not.toBe('none');
    expect(beforeCursorStyle.visibility).not.toBe('hidden');
    expect(afterCursorStyle.insetBlockEnd).toBe(beforeCursorStyle.insetBlockEnd);
    expect(afterCursorStyle.insetInlineStart).toBe('100%');

    const beforeHit = holeElement.querySelector<HTMLElement>(
      ':scope > [data-hole-cursor-hit="before"]',
    );
    const afterHit = holeElement.querySelector<HTMLElement>(
      ':scope > [data-hole-cursor-hit="after"]',
    );
    if (!beforeHit || !afterHit) throw new Error('Hole cursor hit area missing');
    expect(getComputedStyle(beforeHit).position).toBe('absolute');
    expect(getComputedStyle(beforeHit).insetBlock).toBe('0px');
    expect(getComputedStyle(holeElement).getPropertyValue('--lobe-hole-cursor-gutter')).toBe(
      '24px',
    );
    expect(getComputedStyle(beforeHit).width).toBe('var(--lobe-hole-cursor-gutter)');

    const beforePointerDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      cancelable: true,
    });
    beforeHit.dispatchEvent(beforePointerDown);
    await moment();
    await moment();

    expect(beforePointerDown.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(rootElement);

    lexicalEditor.getEditorState().read(() => {
      const hole = $getRoot().getFirstChild();
      const selection = $getSelection();
      if (!(hole instanceof HoleNode) || !$isRangeSelection(selection)) {
        throw new Error('Hole selection missing');
      }
      expect(selection.anchor.key).toBe(hole.getBeforeCursor()?.getKey());
      expect(selection.anchor.offset).toBe(1);
    });

    const afterPointerDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      cancelable: true,
    });
    afterHit.dispatchEvent(afterPointerDown);
    await moment();
    await moment();

    lexicalEditor.getEditorState().read(() => {
      const hole = $getRoot().getFirstChild();
      const selection = $getSelection();
      if (!(hole instanceof HoleNode) || !$isRangeSelection(selection)) {
        throw new Error('Hole selection missing');
      }
      expect(selection.anchor.key).toBe(hole.getAfterCursor()?.getKey());
      expect(selection.anchor.offset).toBe(0);
    });
  });

  it('collapses cursor gutters and disables their hit area while readonly', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    const wrapper = document.createElement('div');
    wrapper.className = styles.root;
    const rootElement = document.createElement('div');
    wrapper.append(rootElement);
    document.body.append(wrapper);
    const lexicalEditor = editor.setRootElement(rootElement);

    lexicalEditor.update(() => {
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode('payload'));
      $getRoot().append($createHoleNode(paragraph));
    });
    await moment();
    editor.setEditable(false);
    rootElement.setAttribute('contenteditable', 'false');
    await moment();

    const contentElement = rootElement.querySelector<HTMLElement>(
      '[data-hole="true"] > [data-hole-content="true"]',
    );
    const beforeCursor = contentElement?.firstElementChild;
    if (!contentElement || !beforeCursor) throw new Error('Hole DOM missing');

    const beforeHit = rootElement.querySelector<HTMLElement>(
      '[data-hole="true"] > [data-hole-cursor-hit="before"]',
    );
    if (!beforeHit) throw new Error('Hole cursor hit area missing');

    expect(rootElement.getAttribute('contenteditable')).toBe('false');
    expect(getComputedStyle(contentElement).width).toBe('100%');
    expect(getComputedStyle(beforeCursor).pointerEvents).toBe('none');
    expect(getComputedStyle(beforeCursor).visibility).toBe('hidden');
    expect(getComputedStyle(beforeHit).pointerEvents).toBe('none');
    expect(getComputedStyle(beforeHit).visibility).toBe('hidden');

    const pointerDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      cancelable: true,
    });
    beforeHit.dispatchEvent(pointerDown);
    await moment();
    expect(pointerDown.defaultPrevented).toBe(false);
  });

  it('removes an empty runtime Hole and leaves an editable root paragraph', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    const lexicalEditor = editor.initNodeEditor()!;

    lexicalEditor.update(() => {
      $getRoot().clear();
      $getRoot().append($createHoleNode());
    });
    await moment();
    await moment();

    lexicalEditor.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(0);
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(['paragraph']);
    });
  });

  it('removes an empty persisted Hole during JSON hydration', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    editor.initNodeEditor();
    editor.setDocument('json', {
      root: {
        children: [
          {
            children: [],
            direction: null,
            format: '',
            indent: 0,
            type: 'hole',
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
    await moment();

    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(HoleNode)).toHaveLength(0);
        expect(
          $getRoot()
            .getChildren()
            .map((node) => node.getType()),
        ).toEqual(['paragraph']);
      });
  });
});
