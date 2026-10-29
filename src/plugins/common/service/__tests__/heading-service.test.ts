import { $createHeadingNode, HeadingNode, registerRichText } from '@lexical/rich-text';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  type ElementNode,
  type LexicalEditor,
  type NodeKey,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { claimHeadingSlug } from '@/utils/heading-slug';

import { HeadingService } from '../heading-service';
import { HEADING_FOLDED_ATTRIBUTE, HEADING_HIDDEN_ATTRIBUTE } from '../i-heading-service';

type Block = ['h1' | 'h2' | 'h3' | 'p', string];

describe('HeadingService', () => {
  let editor: LexicalEditor;
  let root: HTMLDivElement;
  let service: HeadingService;
  let unbind: () => void;
  let unregisterRichText: () => void;
  let keys: NodeKey[];

  const setBlocks = (blocks: Block[]) => {
    editor.update(
      () => {
        const lexicalRoot = $getRoot();
        lexicalRoot.clear();
        keys = blocks.map(([type, text]) => {
          const node = type === 'p' ? $createParagraphNode() : $createHeadingNode(type);
          node.append($createTextNode(text));
          lexicalRoot.append(node);
          return node.getKey();
        });
      },
      { discrete: true },
    );
  };

  const element = (index: number) => editor.getElementByKey(keys[index])!;
  const hiddenIndexes = () =>
    keys
      .map((_, index) => index)
      .filter((index) => element(index).getAttribute(HEADING_HIDDEN_ATTRIBUTE) === 'true');

  beforeEach(() => {
    editor = createEditor({ nodes: [HeadingNode], onError: (error) => Promise.reject(error) });
    root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    editor.setRootElement(root);
    unregisterRichText = registerRichText(editor);
    service = new HeadingService();
    unbind = service.bindEditor(editor);
  });

  afterEach(() => {
    unbind();
    unregisterRichText();
    editor.setRootElement(null);
    root.remove();
  });

  it('assigns unique heading ids in document order', () => {
    setBlocks([
      ['h1', 'Intro'],
      ['p', 'text'],
      ['h2', 'Intro'],
      ['h2', 'Intro 1'],
      ['h3', '!!!'],
    ]);

    expect(element(0).id).toBe('intro');
    expect(element(2).id).toBe('intro-1');
    expect(element(3).id).toBe('intro-1-1');
    expect(element(4).hasAttribute('id')).toBe(false);
    expect(element(1).hasAttribute('id')).toBe(false);
    expect(service.getSlug(keys[2])).toBe('intro-1');
  });

  it('updates ids when heading text changes and keeps them out of the document', () => {
    setBlocks([
      ['h1', 'Intro'],
      ['h2', 'Intro'],
    ]);
    const before = JSON.stringify(editor.getEditorState().toJSON());

    editor.update(
      () => {
        const heading = $getRoot().getFirstChildOrThrow<HeadingNode>();
        heading.getFirstChildOrThrow().remove();
        heading.append($createTextNode('Overview'));
      },
      { discrete: true },
    );

    expect(element(0).id).toBe('overview');
    expect(element(1).id).toBe('intro');
    expect(before).not.toContain('"id"');
    expect(JSON.stringify(editor.getEditorState().toJSON())).not.toContain('intro');
  });

  it('folds content until the next heading of the same or higher level', () => {
    setBlocks([
      ['h1', 'A'],
      ['p', 'a1'],
      ['h2', 'B'],
      ['p', 'b1'],
      ['h1', 'C'],
      ['p', 'c1'],
    ]);

    service.setFolded(keys[2], true);
    expect(hiddenIndexes()).toEqual([3]);
    expect(element(2).getAttribute(HEADING_FOLDED_ATTRIBUTE)).toBe('true');

    service.setFolded(keys[0], true);
    expect(hiddenIndexes()).toEqual([1, 2, 3]);

    service.toggleFolded(keys[0]);
    expect(service.isFolded(keys[0])).toBe(false);
    expect(hiddenIndexes()).toEqual([3]);

    service.setFolded(keys[2], false);
    expect(hiddenIndexes()).toEqual([]);
    expect(element(2).hasAttribute(HEADING_FOLDED_ATTRIBUTE)).toBe(false);
  });

  it('never serializes fold state', () => {
    setBlocks([
      ['h1', 'A'],
      ['p', 'a1'],
    ]);
    const before = JSON.stringify(editor.getEditorState().toJSON());

    service.setFolded(keys[0], true);

    expect(JSON.stringify(editor.getEditorState().toJSON())).toBe(before);
  });

  it('drops the fold when the heading is removed', () => {
    setBlocks([
      ['h1', 'A'],
      ['p', 'a1'],
    ]);
    service.setFolded(keys[0], true);
    const paragraph = element(1);

    editor.update(() => $getRoot().getFirstChildOrThrow().remove(), { discrete: true });

    expect(service.isFolded(keys[0])).toBe(false);
    expect(paragraph.hasAttribute(HEADING_HIDDEN_ATTRIBUTE)).toBe(false);
  });

  it('unfolds when the selection moves into hidden content', () => {
    setBlocks([
      ['h1', 'A'],
      ['p', 'a1'],
    ]);
    service.setFolded(keys[0], true);
    expect(hiddenIndexes()).toEqual([1]);

    editor.update(() => $getRoot().getLastChildOrThrow<ElementNode>().selectEnd(), {
      discrete: true,
    });

    expect(service.isFolded(keys[0])).toBe(false);
    expect(hiddenIndexes()).toEqual([]);
  });

  it('notifies subscribers when fold state changes', () => {
    setBlocks([
      ['h1', 'A'],
      ['p', 'a1'],
    ]);
    let calls = 0;
    const unsubscribe = service.subscribe(() => {
      calls += 1;
    });

    service.toggleFolded(keys[0]);
    service.toggleFolded(keys[0]);
    unsubscribe();
    service.toggleFolded(keys[0]);

    expect(calls).toBe(2);
  });
});

describe('claimHeadingSlug', () => {
  it('dedupes slugs and avoids collisions with literal suffixes', () => {
    const slugs = new Map<string, number>();
    expect(
      ['Foo', 'Foo', 'Foo-1', 'Foo', '中文 标题'].map((t) => claimHeadingSlug(t, slugs)),
    ).toEqual(['foo', 'foo-1', 'foo-1-1', 'foo-2', '中文-标题']);
  });
});
