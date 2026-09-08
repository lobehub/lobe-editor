import { $createListItemNode, $createListNode, ListItemNode, ListNode } from '@lexical/list';
import { $createQuoteNode } from '@lexical/rich-text';
import {
  $createTableNodeWithDimensions,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $nodesOfType,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment, resetRandomKey } from '@/editor-kernel';
import { ArtifactNode, $createArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { CommonPlugin } from '@/plugins/common';
import { $createHoleNode, $isHoleNode, HoleNode } from '@/plugins/common/node/hole';
import { $createBlockImageNode, BlockImageNode } from '@/plugins/image/node/block-image-node';
import { $createImageNode, ImageNode } from '@/plugins/image/node/image-node';
import type { IEditor, IEditorKernel } from '@/types';

import { $reconcileHoleTargets, createHoleNormalizationRegistry } from './hole-normalization';

const blockImage = () =>
  $createBlockImageNode({
    altText: 'A block image',
    maxWidth: 640,
    src: 'https://example.com/block.png',
    width: 320,
  });

const inlineImage = () =>
  $createImageNode({
    altText: 'An inline image',
    maxWidth: 320,
    src: 'https://example.com/inline.png',
    width: 160,
  });

const createEditor = (): IEditor => {
  const editor = Editor.createEditor() as IEditorKernel;
  editor.registerPlugins([CommonPlugin]);
  editor.registerNodes([
    ArtifactNode,
    BlockImageNode,
    ImageNode,
    ListNode,
    ListItemNode,
    TableNode,
    TableRowNode,
    TableCellNode,
  ]);
  editor.initHeadlessEditor();
  return editor;
};

describe('Hole normalization', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = createEditor();
  });

  afterEach(() => editor.destroy());

  it('uses one registry and one wrapper algorithm for Artifact and BlockImage targets', async () => {
    const lexical = editor.getLexicalEditor()!;
    const registry = createHoleNormalizationRegistry([ArtifactNode, BlockImageNode]);
    let artifactKey = '';
    let imageKey = '';
    let holes = 0;

    lexical.update(
      () => {
        const artifact = $createArtifactNode('<main>Artifact</main>', 'Demo');
        const image = blockImage();
        artifactKey = artifact.getKey();
        imageKey = image.getKey();
        $getRoot().append(artifact, image);
        holes = $reconcileHoleTargets($getRoot(), { registry }).length;
      },
      { discrete: true },
    );
    await moment();

    expect(holes).toBe(2);
    lexical.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children.map((node) => node.getType())).toEqual(['hole', 'hole']);
      expect($nodesOfType(HoleNode)).toHaveLength(2);
      expect($isHoleNode(children[0]) && children[0].getContentChildren()[0]?.getKey()).toBe(
        artifactKey,
      );
      expect($isHoleNode(children[1]) && children[1].getContentChildren()[0]?.getKey()).toBe(
        imageKey,
      );
    });
  });

  it('promotes a mixed paragraph while preserving text order and paragraph formatting', async () => {
    const lexical = editor.getLexicalEditor()!;
    const registry = createHoleNormalizationRegistry([BlockImageNode]);
    let imageKey = '';

    lexical.update(
      () => {
        const paragraph = $createParagraphNode();
        paragraph.setFormat('center');
        paragraph.setIndent(2);
        paragraph.setDirection('rtl');
        const image = blockImage();
        imageKey = image.getKey();
        paragraph.append($createTextNode('before'), image, $createTextNode('after'));
        $getRoot().append(paragraph);
        expect($reconcileHoleTargets($getRoot(), { registry })).toHaveLength(1);
      },
      { discrete: true },
    );
    await moment();

    lexical.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children.map((node) => node.getType())).toEqual(['paragraph', 'hole', 'paragraph']);
      expect(children[0]?.getTextContent()).toBe('before');
      expect(children[2]?.getTextContent()).toBe('after');
      expect($isHoleNode(children[1]) && children[1].getContentChildren()[0]?.getKey()).toBe(
        imageKey,
      );
      const trailingParagraph = children[2];
      if (!$isElementNode(trailingParagraph)) throw new Error('Trailing paragraph missing');
      expect(trailingParagraph.getFormatType()).toBe('center');
      expect(trailingParagraph.getIndent()).toBe(2);
      expect(trailingParagraph.getDirection()).toBe('rtl');
    });
  });

  it.each(['quote', 'list-item', 'table-cell'] as const)(
    'keeps the %s container when wrapping a direct block target',
    async (containerKind) => {
      const lexical = editor.getLexicalEditor()!;
      const registry = createHoleNormalizationRegistry([BlockImageNode]);
      lexical.update(
        () => {
          const image = blockImage();
          if (containerKind === 'quote') {
            const quote = $createQuoteNode();
            quote.append(image);
            $getRoot().append(quote);
          } else if (containerKind === 'list-item') {
            const list = $createListNode('bullet');
            const item = $createListItemNode();
            item.append(image);
            list.append(item);
            $getRoot().append(list);
          } else {
            const table = $createTableNodeWithDimensions(1, 1, false);
            const row = table.getFirstChildOrThrow<TableRowNode>();
            const cell = row.getFirstChildOrThrow<TableCellNode>();
            cell.clear();
            cell.append(image);
            $getRoot().append(table);
          }
          expect($reconcileHoleTargets($getRoot(), { registry })).toHaveLength(1);
        },
        { discrete: true },
      );
      await moment();

      lexical.getEditorState().read(() => {
        const rootChildren = $getRoot().getChildren();
        const rootContainer = rootChildren[0];
        if (!$isElementNode(rootContainer)) throw new Error('Root container missing');
        const firstChild = rootContainer.getFirstChild();
        const container =
          containerKind === 'quote'
            ? rootContainer
            : containerKind === 'list-item'
              ? firstChild
              : $isElementNode(firstChild)
                ? firstChild.getFirstChild()
                : null;
        if (!$isElementNode(container)) throw new Error('Container missing');
        expect(container?.getType()).toBe(
          containerKind === 'quote'
            ? 'quote'
            : containerKind === 'list-item'
              ? 'listitem'
              : 'tablecell',
        );
        expect(container.getFirstChild()?.getType()).toBe('hole');
        expect(container.getChildrenSize()).toBe(1);
      });
    },
  );

  it('skips inline and unregistered nodes, honors the shared-node guard, and is idempotent', async () => {
    const lexical = editor.getLexicalEditor()!;
    const registry = createHoleNormalizationRegistry([ArtifactNode, BlockImageNode, ImageNode]);
    let sharedKey = '';
    let firstPass = 0;
    let secondPass = 0;

    lexical.update(
      () => {
        const sharedImage = blockImage();
        sharedKey = sharedImage.getKey();
        const sharedParagraph = $createParagraphNode();
        sharedParagraph.append(sharedImage);
        const inlineParagraph = $createParagraphNode();
        inlineParagraph.append(inlineImage(), $createTextNode('plain'));
        $getRoot().append(sharedParagraph, inlineParagraph);
        firstPass = $reconcileHoleTargets($getRoot(), {
          canNormalize: (node) => node.getKey() !== sharedKey,
          registry,
        }).length;
      },
      { discrete: true },
    );
    await moment();
    lexical.update(
      () => {
        secondPass = $reconcileHoleTargets($getRoot(), {
          canNormalize: () => true,
          registry,
        }).length;
      },
      { discrete: true },
    );
    await moment();

    expect(firstPass).toBe(0);
    expect(secondPass).toBe(1);
    lexical.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children.map((node) => node.getType())).toEqual(['hole', 'paragraph']);
      const inlineParagraph = children[1];
      if (!$isElementNode(inlineParagraph)) throw new Error('Inline paragraph missing');
      expect(inlineParagraph.getChildren().map((node) => node.getType())).toEqual([
        'image',
        'text',
      ]);
    });
  });

  it('uses registration tokens and only skips a target directly owned by an existing Hole', async () => {
    const lexical = editor.getLexicalEditor()!;
    const registry = createHoleNormalizationRegistry(['block-image']);
    const unregisterFirst = registry.register('block-image');
    const unregisterSecond = registry.register('block-image');
    unregisterFirst();
    expect(registry.targets).toEqual(['block-image', 'block-image']);
    unregisterSecond();
    expect(registry.targets).toEqual(['block-image']);

    let directCount = 0;
    let nestedCount = 0;
    lexical.update(
      () => {
        $getRoot().append($createHoleNode(blockImage()));
        const compositeHole = $createHoleNode();
        const quote = $createQuoteNode();
        quote.append(blockImage());
        compositeHole.splice(1, 0, [quote]);
        $getRoot().append(compositeHole);
        const holes = $reconcileHoleTargets($getRoot(), { registry });
        directCount = holes.filter((hole) => hole.getParent() === $getRoot()).length;
        nestedCount = holes.filter((hole) => hole.getParent()?.getType() === 'quote').length;
      },
      { discrete: true },
    );
    await moment();

    expect(directCount).toBe(0);
    expect(nestedCount).toBe(1);
    lexical.getEditorState().read(() => {
      const rootChildren = $getRoot().getChildren();
      expect(rootChildren).toHaveLength(2);
      expect(rootChildren.every((node) => node.getType() === 'hole')).toBe(true);
      const rootHole = rootChildren[1];
      if (!$isHoleNode(rootHole)) throw new Error('Composite Hole missing');
      const nestedQuote = rootHole.getContentChildren()[0];
      expect(nestedQuote?.getType()).toBe('quote');
      if (!$isElementNode(nestedQuote)) throw new Error('Nested quote missing');
      expect(nestedQuote.getFirstChild()?.getType()).toBe('hole');
    });
  });
});
