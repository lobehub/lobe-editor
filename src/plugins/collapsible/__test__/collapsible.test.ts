import { beforeEach, describe, expect, it } from 'vitest';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  LexicalEditor,
  LexicalNode,
} from 'lexical';

import Editor, { resetRandomKey } from '@/editor-kernel';
import { BlockPlugin } from '@/plugins/block';
import { MOVE_BLOCK_COMMAND } from '@/plugins/block/command';
import { filterDragBlocksForSource } from '@/plugins/block/react/drag/drag-utils';
import { CommonPlugin, INSERT_HEADING_COMMAND, INSERT_QUOTE_COMMAND } from '@/plugins/common';
import { INSERT_CODEMIRROR_COMMAND } from '@/plugins/codemirror-block';
import { $createCodeMirrorNode } from '@/plugins/codemirror-block/node/CodeMirrorNode';
import { CodemirrorPlugin } from '@/plugins/codemirror-block/plugin';
import { HRPlugin, INSERT_HORIZONTAL_RULE_COMMAND } from '@/plugins/hr';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { INSERT_TABLE_COMMAND, TablePlugin } from '@/plugins/table';
import { IEditor } from '@/types';

import { INSERT_COLLAPSIBLE_COMMAND } from '../command';
import { $createCollapsibleNode, $isCollapsibleNode, CollapsibleNode } from '../node/CollapsibleNode';
import { CollapsiblePlugin } from '../plugin';

describe('collapsible plugin', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([
      LitexmlPlugin,
      MarkdownPlugin,
      CommonPlugin,
      BlockPlugin,
      CodemirrorPlugin,
      [HRPlugin, { decorator: () => null }],
      TablePlugin,
      CollapsiblePlugin,
    ]);
    editor.initNodeEditor();
  });

  it('reads and writes litexml', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><collapsible id="1" title="More" collapsed="true"><p id="2"><span id="3">Hidden text</span></p></collapsible></root>',
    );

    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toContain('<details>');
    expect(markdown).toContain('<summary>More</summary>');
    expect(markdown).toContain('Hidden text');
  });

  it('inserts an empty visible paragraph and content paragraph by default', () => {
    editor.dispatchCommand(INSERT_COLLAPSIBLE_COMMAND, { collapsed: true });

    const json = editor.getDocument('json') as unknown as any;
    const collapsible = json.root.children[0];
    expect(collapsible.type).toBe('collapsible');
    expect(collapsible.collapsed).toBe(true);
    expect(collapsible.title).toBe('');
    expect(collapsible.children).toHaveLength(2);
    expect(collapsible.children[0].children).toHaveLength(0);
    expect(collapsible.children[1].children).toHaveLength(0);
  });

  it('uses explicit insert title as the first visible paragraph', () => {
    editor.dispatchCommand(INSERT_COLLAPSIBLE_COMMAND, {
      collapsed: true,
      title: '折叠块',
    });

    const json = editor.getDocument('json') as unknown as any;
    const collapsible = json.root.children[0];
    expect(collapsible.type).toBe('collapsible');
    expect(collapsible.collapsed).toBe(true);
    expect(collapsible.title).toBe('折叠块');
    expect(collapsible.children).toHaveLength(2);
    expect(collapsible.children[0].children[0].text).toBe('折叠块');
    expect(collapsible.children[1].children).toHaveLength(0);
  });

  it('reads markdown details blocks', () => {
    editor.setDocument(
      'markdown',
      '<details open>\n<summary>More</summary>\n\nHidden text\n</details>',
    );

    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml).toContain('<collapsible');
    expect(xml).toContain('title="More"');
    expect(xml).toContain('collapsed="false"');
  });

  it('imports markdown summary as the first visible child', () => {
    editor.setDocument(
      'markdown',
      '<details>\n<summary>More</summary>\n\nHidden text\n</details>',
    );

    const json = editor.getDocument('json') as unknown as any;
    const collapsible = json.root.children[0];
    expect(collapsible.collapsed).toBe(true);
    expect(collapsible.children[0].children[0].text).toBe('More');
    expect(JSON.stringify(collapsible.children.slice(1))).toContain('Hidden text');
  });

  it('prepends legacy litexml title without dropping existing content', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><collapsible id="1" title="More" collapsed="true"><p id="2"><span id="3">Hidden text</span></p></collapsible></root>',
    );

    const json = editor.getDocument('json') as unknown as any;
    const collapsible = json.root.children[0];
    expect(collapsible.children[0].children[0].text).toBe('More');
    expect(JSON.stringify(collapsible.children.slice(1))).toContain('Hidden text');
  });

  it('prepends legacy json title before existing content', () => {
    editor.setDocument('json', {
      root: {
        children: [
          {
            children: [
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'Hidden text',
                    type: 'text',
                    version: 1,
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                textFormat: 0,
                textStyle: '',
                type: 'paragraph',
                version: 1,
              },
            ],
            collapsed: true,
            direction: 'ltr',
            format: '',
            indent: 0,
            title: 'More',
            type: 'collapsible',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    });

    const json = editor.getDocument('json') as unknown as any;
    const collapsible = json.root.children[0];
    expect(collapsible.children[0].children[0].text).toBe('More');
    expect(collapsible.children[1].children[0].text).toBe('Hidden text');
    expect(collapsible.title).toBe('More');
  });

  it('moves across visible empty paragraphs with arrow up and down', () => {
    const lexicalEditor = editor.getLexicalEditor() as LexicalEditor;

    setupArrowBoundaryDocument(lexicalEditor, false);

    selectNode(lexicalEditor, 'before');
    dispatchArrow(lexicalEditor, 'down');
    expect(getSelectionLabel(lexicalEditor)).toBe('title');

    dispatchArrow(lexicalEditor, 'down');
    expect(getSelectionLabel(lexicalEditor)).toBe('body');

    dispatchArrow(lexicalEditor, 'down');
    expect(getSelectionLabel(lexicalEditor)).toBe('after');

    selectNode(lexicalEditor, 'after');
    dispatchArrow(lexicalEditor, 'up');
    expect(getSelectionLabel(lexicalEditor)).toBe('body');

    dispatchArrow(lexicalEditor, 'up');
    expect(getSelectionLabel(lexicalEditor)).toBe('title');

    dispatchArrow(lexicalEditor, 'up');
    expect(getSelectionLabel(lexicalEditor)).toBe('before');
  });

  it('creates visible boundary paragraphs when moving out of an edge collapsible', () => {
    const lexicalEditor = editor.getLexicalEditor() as LexicalEditor;

    setupSingleCollapsibleDocument(lexicalEditor, false);

    selectSingleCollapsibleChild(lexicalEditor, 'title');
    dispatchArrow(lexicalEditor, 'up');
    expect(getSelectionLabel(lexicalEditor)).toBe('before');
    expect(getRootChildTypes(lexicalEditor)).toEqual(['paragraph', 'collapsible']);

    selectSingleCollapsibleChild(lexicalEditor, 'body');
    dispatchArrow(lexicalEditor, 'down');
    expect(getSelectionLabel(lexicalEditor)).toBe('after');
    expect(getRootChildTypes(lexicalEditor)).toEqual(['paragraph', 'collapsible', 'paragraph']);
  });

  it('moves from an empty title paragraph on real root keydown', () => {
    const lexicalEditor = editor.getLexicalEditor() as LexicalEditor;
    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    editor.setRootElement(rootElement);

    try {
      setupArrowBoundaryDocument(lexicalEditor, false);
      selectNode(lexicalEditor, 'title');

      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'ArrowUp',
      });
      rootElement.dispatchEvent(event);
      lexicalEditor.update(() => {}, { discrete: true });

      expect(event.defaultPrevented).toBe(true);
      expect(getSelectionLabel(lexicalEditor)).toBe('before');
    } finally {
      editor.setRootElement(document.createElement('div'));
      rootElement.remove();
    }
  });

  it('does not handle document keydown while focus is outside editor', () => {
    const lexicalEditor = editor.getLexicalEditor() as LexicalEditor;
    const rootElement = document.createElement('div');
    const outsideInput = document.createElement('input');
    document.body.append(rootElement, outsideInput);
    editor.setRootElement(rootElement);

    try {
      setupArrowBoundaryDocument(lexicalEditor, false);
      selectNode(lexicalEditor, 'title');
      outsideInput.focus();

      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'ArrowUp',
      });
      document.dispatchEvent(event);
      lexicalEditor.update(() => {}, { discrete: true });

      expect(event.defaultPrevented).toBe(false);
      expect(getSelectionLabel(lexicalEditor)).toBe('title');
    } finally {
      editor.setRootElement(document.createElement('div'));
      rootElement.remove();
      outsideInput.remove();
    }
  });

  it('creates a temporary paragraph before collapsible when previous block is a decorator', async () => {
    const lexicalEditor = editor.getLexicalEditor() as LexicalEditor;
    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    editor.setRootElement(rootElement);

    try {
      lexicalEditor.update(
        () => {
          const root = $getRoot();
          root.clear();

          const code = $createCodeMirrorNode(
            'typescript',
            "import { Editor } from '@lobehub/editor';",
          );
          const collapsible = $createCollapsibleNode('Details', false);
          collapsible.append($createParagraphNode(), $createParagraphNode());

          root.append(code, collapsible);
        },
        { discrete: true },
      );

      selectSingleCollapsibleChild(lexicalEditor, 'title');

      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'ArrowUp',
      });
      document.dispatchEvent(event);
      lexicalEditor.update(() => {}, { discrete: true });

      expect(event.defaultPrevented).toBe(true);
      expect(getRootChildTypes(lexicalEditor)).toEqual(['code', 'paragraph', 'collapsible']);
      expect(getSelectionLabel(lexicalEditor)).toBe('before');

      const downEvent = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'ArrowDown',
      });

      document.dispatchEvent(downEvent);
      await Promise.resolve();
      lexicalEditor.update(() => {}, { discrete: true });

      expect(downEvent.defaultPrevented).toBe(true);
      expect(getRootChildTypes(lexicalEditor)).toEqual(['code', 'collapsible']);
      expect(getSelectionLabel(lexicalEditor)).toBe('title');
    } finally {
      editor.setRootElement(document.createElement('div'));
      rootElement.remove();
    }
  });

  it('converts a paragraph inside collapsible to quote', () => {
    const lexicalEditor = editor.getLexicalEditor() as LexicalEditor;

    setupSingleCollapsibleDocument(lexicalEditor, false);
    selectSingleCollapsibleChild(lexicalEditor, 'body');
    expect(getSelectionLabel(lexicalEditor)).toBe('body');
    expect(getSelectionDebug(lexicalEditor)).toEqual(['paragraph']);

    lexicalEditor.dispatchCommand(INSERT_QUOTE_COMMAND, undefined);
    lexicalEditor.update(() => {}, { discrete: true });

    expect(getRootChildTypes(lexicalEditor)).toEqual(['collapsible']);
    expect(getCollapsibleChildTypes(lexicalEditor)).toEqual(['paragraph', 'quote']);
  });

  it.each(['heading', 'horizontalrule', 'code'])(
    'keeps %s insertion inside collapsible',
    (expectedType) => {
    const lexicalEditor = editor.getLexicalEditor() as LexicalEditor;

    setupSingleCollapsibleDocument(lexicalEditor, false);
    selectSingleCollapsibleChild(lexicalEditor, 'body');

    if (expectedType === 'heading') {
      lexicalEditor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h2' });
    } else if (expectedType === 'horizontalrule') {
      lexicalEditor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
    } else {
      lexicalEditor.dispatchCommand(INSERT_CODEMIRROR_COMMAND, undefined);
    }
    lexicalEditor.update(() => {}, { discrete: true });
    expect(getCollapsibleChildTypes(lexicalEditor)).toEqual(['paragraph', expectedType]);
    },
  );

  it('does not nest table or collapsible blocks inside collapsible', () => {
    const lexicalEditor = editor.getLexicalEditor() as LexicalEditor;

    setupSingleCollapsibleDocument(lexicalEditor, false);
    selectSingleCollapsibleChild(lexicalEditor, 'body');

    lexicalEditor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '2', rows: '2' });
    lexicalEditor.update(() => {}, { discrete: true });
    expect(getCollapsibleChildTypes(lexicalEditor)).toEqual(['paragraph', 'paragraph']);
    expect(getRootChildTypes(lexicalEditor)).toEqual(['collapsible', 'table']);

    selectSingleCollapsibleChild(lexicalEditor, 'body');
    lexicalEditor.dispatchCommand(INSERT_COLLAPSIBLE_COMMAND, undefined);
    lexicalEditor.update(() => {}, { discrete: true });
    expect(getCollapsibleChildTypes(lexicalEditor)).toEqual(['paragraph', 'paragraph']);
    expect(getRootChildTypes(lexicalEditor)).toEqual(['collapsible', 'collapsible', 'table']);
  });

  it('marks collapsible children as editable blocks', () => {
    const lexicalEditor = editor.getLexicalEditor() as LexicalEditor;
    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    editor.setRootElement(rootElement);

    try {
      setupSingleCollapsibleDocument(lexicalEditor, false);
      lexicalEditor.update(() => {}, { discrete: true });

      const blockElements = Array.from(rootElement.querySelectorAll<HTMLElement>('[data-block-id]'));
      expect(blockElements.map((element) => element.tagName)).toEqual(['SECTION', 'P']);

      const title = rootElement.querySelector<HTMLElement>(
        '[data-collapsible-content="true"] > :first-child',
      );
      expect(title?.dataset.blockId).toBeUndefined();
    } finally {
      editor.setRootElement(document.createElement('div'));
      rootElement.remove();
    }
  });

  it('filters collapsible inner blocks when dragging a collapsible block', () => {
    const source = document.createElement('section');
    source.dataset.blockId = 'source';
    source.dataset.collapsible = 'true';

    const target = document.createElement('section');
    target.dataset.blockId = 'target';
    target.dataset.collapsible = 'true';

    const targetBody = document.createElement('p');
    targetBody.dataset.blockId = 'target-body';
    target.append(targetBody);

    const outside = document.createElement('p');
    outside.dataset.blockId = 'outside';

    const blocks = [source, target, targetBody, outside].map((block, index) => ({
      block,
      blockId: block.dataset.blockId!,
      rect: {
        bottom: index * 10 + 10,
        height: 10,
        left: 0,
        top: index * 10,
        width: 100,
      },
    }));

    expect(filterDragBlocksForSource('source', blocks).map((block) => block.blockId)).toEqual([
      'source',
      'target',
      'outside',
    ]);
  });

  it('does not move a collapsible block into another collapsible by command', () => {
    const lexicalEditor = editor.getLexicalEditor() as LexicalEditor;
    let sourceKey = '';
    let targetBodyKey = '';

    lexicalEditor.update(
      () => {
        const root = $getRoot();
        root.clear();

        const source = $createCollapsibleNode('Source', false);
        source.append($createParagraphNode(), $createParagraphNode());

        const target = $createCollapsibleNode('Target', false);
        const targetTitle = $createParagraphNode();
        targetTitle.append($createTextNode('Target'));
        const targetBody = $createParagraphNode();
        targetBody.append($createTextNode('Body'));
        target.append(targetTitle, targetBody);

        sourceKey = source.getKey();
        targetBodyKey = targetBody.getKey();

        root.append(source, target);
      },
      { discrete: true },
    );

    lexicalEditor.dispatchCommand(MOVE_BLOCK_COMMAND, {
      placement: 'after',
      sourceBlockId: sourceKey,
      targetBlockId: targetBodyKey,
    });
    lexicalEditor.update(() => {}, { discrete: true });

    expect(getRootChildTypes(lexicalEditor)).toEqual(['collapsible', 'collapsible']);
    expect(getCollapsibleChildTypes(lexicalEditor)).toEqual(['paragraph', 'paragraph']);
  });
});

function setupArrowBoundaryDocument(editor: LexicalEditor, collapsed: boolean) {
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();

      const before = $createParagraphNode();
      before.append($createTextNode('Before'));

      const collapsible = $createCollapsibleNode('Details', collapsed);
      collapsible.append($createParagraphNode(), $createParagraphNode());

      const after = $createParagraphNode();
      after.append($createTextNode('After'));

      root.append(before, collapsible, after);
    },
    { discrete: true },
  );
}

function setupSingleCollapsibleDocument(editor: LexicalEditor, collapsed: boolean) {
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();

      const collapsible = $createCollapsibleNode('Details', collapsed);
      collapsible.append($createParagraphNode(), $createParagraphNode());

      root.append(collapsible);
    },
    { discrete: true },
  );
}

function selectNode(editor: LexicalEditor, label: 'after' | 'before' | 'body' | 'title') {
  editor.update(() => {
    if (label === 'before') {
      $getRoot().getChildAtIndex(0)?.selectStart();
      return;
    }
    if (label === 'after') {
      $getRoot().getChildAtIndex(2)?.selectStart();
      return;
    }

    const collapsible = $getRoot().getChildAtIndex(1);
    if (!$isCollapsibleNode(collapsible)) throw new Error('Missing collapsible node');
    collapsible.getChildAtIndex(label === 'title' ? 0 : 1)?.selectStart();
  }, { discrete: true });
}

function selectSingleCollapsibleChild(editor: LexicalEditor, label: 'body' | 'title') {
  editor.update(() => {
    const collapsible = $getRoot().getChildren().find($isCollapsibleNode);
    if (!$isCollapsibleNode(collapsible)) throw new Error('Missing collapsible node');
    collapsible.getChildAtIndex(label === 'title' ? 0 : 1)?.selectStart();
  }, { discrete: true });
}

function dispatchArrow(editor: LexicalEditor, direction: 'down' | 'up') {
  const event = {
    preventDefault() {},
    shiftKey: false,
    stopImmediatePropagation() {},
  } as KeyboardEvent;

  editor.dispatchCommand(
    direction === 'down' ? KEY_ARROW_DOWN_COMMAND : KEY_ARROW_UP_COMMAND,
    event,
  );
  editor.update(() => {}, { discrete: true });
}

function getSelectionLabel(editor: LexicalEditor): string {
  let label = 'unknown';

  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

    const focusNode = selection.focus.getNode();
    const root = $getRoot();
    const rootChildren = root.getChildren();
    const collapsibleIndex = rootChildren.findIndex($isCollapsibleNode);
    const collapsible = collapsibleIndex >= 0 ? rootChildren[collapsibleIndex] : null;
    const before = collapsibleIndex > 0 ? rootChildren[collapsibleIndex - 1] : null;
    const after =
      collapsibleIndex >= 0 && collapsibleIndex < rootChildren.length - 1
        ? rootChildren[collapsibleIndex + 1]
        : null;

    if (isDescendantOrSelf(focusNode, before)) {
      label = 'before';
      return;
    }
    if (isDescendantOrSelf(focusNode, after)) {
      label = 'after';
      return;
    }
    if ($isCollapsibleNode(collapsible)) {
      if (focusNode === collapsible) {
        label = selection.focus.offset === 0 ? 'title' : 'body';
        return;
      }
      if (isDescendantOrSelf(focusNode, collapsible.getChildAtIndex(0))) {
        label = 'title';
        return;
      }
      if (isDescendantOrSelf(focusNode, collapsible.getChildAtIndex(1))) {
        label = 'body';
      }
    }
  });

  return label;
}

function getRootChildTypes(editor: LexicalEditor): string[] {
  let types: string[] = [];

  editor.getEditorState().read(() => {
    types = $getRoot().getChildren().map((node) => node.getType());
  });

  return types;
}

function getCollapsibleChildTypes(editor: LexicalEditor): string[] {
  let types: string[] = [];

  editor.getEditorState().read(() => {
    const collapsible = $getRoot().getChildren().find($isCollapsibleNode);
    if ($isCollapsibleNode(collapsible)) {
      types = collapsible.getChildren().map((node) => node.getType());
    }
  });

  return types;
}

function getSelectionDebug(editor: LexicalEditor): string[] {
  let result: string[] = [];

  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    result = selection.getNodes().map((node) => node.getType());
  });

  return result;
}

function isDescendantOrSelf(node: LexicalNode, ancestor: LexicalNode | null | undefined): boolean {
  let current: LexicalNode | null = node;
  while (current) {
    if (current === ancestor) return true;
    current = current.getParent();
  }
  return false;
}
