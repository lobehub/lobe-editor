import { $createCodeNode, CodeNode } from '@lexical/code-core';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $createListItemNode, $createListNode } from '@lexical/list';
import {
  $createTableNodeWithDimensions,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  $isTextNode,
  $nodesOfType,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  type LexicalNode,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { $createArtifactNode, ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { ArtifactPlugin } from '@/plugins/artifact/plugin';
import { $createBlockFileNode, BlockFileNode } from '@/plugins/file/node/BlockFileNode';
import { FilePlugin } from '@/plugins/file/plugin';
import { CommonPlugin } from '@/plugins/common/plugin';
import {
  $createHorizontalRuleNode,
  HorizontalRuleNode,
} from '@/plugins/hr/node/HorizontalRuleNode';
import { HRPlugin } from '@/plugins/hr/plugin';
import { $createBlockImageNode, BlockImageNode } from '@/plugins/image/node/block-image-node';
import { ImagePlugin } from '@/plugins/image/plugin';
import { $createLinkBlockCardNode, LinkBlockCardNode } from '@/plugins/link/node/LinkBlockCardNode';
import { $createLinkIframeNode, LinkIframeNode } from '@/plugins/link/node/LinkIframeNode';
import { LinkPlugin } from '@/plugins/link/plugin';
import { $createMathBlockNode, MathBlockNode } from '@/plugins/math/node';
import { MathPlugin } from '@/plugins/math/plugin';
import { ListPlugin } from '@/plugins/list/plugin';
import {
  $createCollapsibleNode,
  CollapsibleNode,
} from '@/plugins/collapsible/node/CollapsibleNode';
import { CodeblockPlugin } from '@/plugins/codeblock/plugin';
import {
  $createCodeMirrorNode,
  CodeMirrorNode,
} from '@/plugins/codemirror-block/node/CodeMirrorNode';
import { CodemirrorPlugin } from '@/plugins/codemirror-block/plugin';
import { TablePlugin } from '@/plugins/table/plugin';
import type { IEditor, IEditorKernel, IPlugin } from '@/types';

import { getHoleContentEntrySide } from '../command';
import { HoleNode } from './hole';

type HoleTargetCase = {
  create: () => LexicalNode;
  headlessEntry: 'accept' | 'reject';
  label: string;
  plugins: IPlugin[];
  type: string;
};

const createTableTarget = (): TableNode => {
  const table = $createTableNodeWithDimensions(2, 2, false);
  const firstRow = table.getFirstChildOrThrow<TableRowNode>();
  const firstCell = firstRow.getFirstChildOrThrow<TableCellNode>();
  const lastRow = table.getLastChildOrThrow<TableRowNode>();
  const lastCell = lastRow.getLastChildOrThrow<TableCellNode>();
  firstCell.clear().append($createParagraphNode().append($createTextNode('table-first')));
  lastCell.clear().append($createParagraphNode().append($createTextNode('table-last')));
  return table;
};

const targetCases: HoleTargetCase[] = [
  {
    create: () => $createHorizontalRuleNode(),
    headlessEntry: 'reject',
    label: 'hr',
    plugins: [HRPlugin],
    type: HorizontalRuleNode.getType(),
  },
  {
    create: () => $createBlockFileNode('contract.pdf', 'https://example.test/contract.pdf'),
    headlessEntry: 'reject',
    label: 'block-file',
    plugins: [FilePlugin],
    type: BlockFileNode.getType(),
  },
  {
    create: () => $createMathBlockNode('x^2'),
    headlessEntry: 'reject',
    label: 'mathBlock',
    plugins: [MathPlugin],
    type: MathBlockNode.getType(),
  },
  {
    create: () =>
      $createLinkBlockCardNode({ title: 'Block card', url: 'https://example.test/card' }),
    headlessEntry: 'reject',
    label: 'link-block-card',
    plugins: [LinkPlugin],
    type: LinkBlockCardNode.getType(),
  },
  {
    create: () => $createLinkIframeNode({ title: 'Iframe', url: 'https://example.test/iframe' }),
    headlessEntry: 'reject',
    label: 'link-iframe',
    plugins: [LinkPlugin],
    type: LinkIframeNode.getType(),
  },
  {
    create: () => $createArtifactNode('<main>contract</main>', 'Contract artifact'),
    headlessEntry: 'reject',
    label: 'artifact',
    plugins: [ArtifactPlugin],
    type: ArtifactNode.getType(),
  },
  {
    create: () =>
      $createBlockImageNode({
        altText: 'Contract image',
        maxWidth: 640,
        src: 'https://example.test/contract.png',
        width: 320,
      }),
    headlessEntry: 'reject',
    label: 'image',
    plugins: [ImagePlugin],
    type: BlockImageNode.getType(),
  },
  {
    create: createTableTarget,
    headlessEntry: 'accept',
    label: 'table',
    plugins: [TablePlugin],
    type: TableNode.getType(),
  },
  {
    create: () => {
      const code = $createCodeNode('typescript');
      code.append($createTextNode('const contract = true;'));
      return code;
    },
    headlessEntry: 'accept',
    label: 'code',
    plugins: [CodeblockPlugin],
    type: CodeNode.getType(),
  },
  {
    create: () => $createCodeMirrorNode('typescript', 'const mirror = true;'),
    headlessEntry: 'reject',
    label: 'code-mirror',
    plugins: [CodemirrorPlugin],
    type: CodeMirrorNode.getType(),
  },
];

const editors: IEditor[] = [];

const createEditorWithTarget = async (
  targetCase: HoleTargetCase,
  consecutive = false,
): Promise<{ editor: IEditor; targetKey: string }> => {
  const editor = Editor.createEditor().registerPlugins([CommonPlugin, ...targetCase.plugins]);
  editors.push(editor);
  editor.initHeadlessEditor();

  let targetKey = '';
  editor.getLexicalEditor()!.update(
    () => {
      const before = $createParagraphNode().append($createTextNode('before'));
      const target = targetCase.create();
      targetKey = target.getKey();
      const children: LexicalNode[] = [before, target];
      if (consecutive) children.push(targetCase.create());
      children.push($createParagraphNode().append($createTextNode('after')));
      $getRoot().append(...children);
    },
    { discrete: true },
  );
  await moment();
  await moment();
  return { editor, targetKey };
};

const getHoleForTarget = (editor: IEditor, targetKey: string): HoleNode => {
  const hole = editor
    .getLexicalEditor()!
    .getEditorState()
    .read(() => {
      const target = $getNodeByKey(targetKey);
      return target?.getParent() instanceof HoleNode ? target.getParent() : null;
    });
  if (!(hole instanceof HoleNode)) throw new Error('Target is not wrapped by a Hole');
  return hole;
};

const selectHoleBoundary = async (
  editor: IEditor,
  hole: HoleNode,
  side: 'before' | 'after',
): Promise<void> => {
  editor.getLexicalEditor()!.update(
    () => {
      const cursor = side === 'before' ? hole.getBeforeCursor() : hole.getAfterCursor();
      if (!cursor) throw new Error(`${side} Hole cursor is missing`);
      if (side === 'before') cursor.selectEnd();
      else cursor.selectStart();
    },
    { discrete: true },
  );
  await moment();
};

const dispatchVerticalArrow = async (editor: IEditor, direction: 'up' | 'down'): Promise<void> => {
  const event = new KeyboardEvent('keydown', {
    cancelable: true,
    key: direction === 'up' ? 'ArrowUp' : 'ArrowDown',
  });
  const command = direction === 'up' ? KEY_ARROW_UP_COMMAND : KEY_ARROW_DOWN_COMMAND;
  expect(editor.getLexicalEditor()!.dispatchCommand(command, event)).toBe(true);
  expect(event.defaultPrevented).toBe(true);
  await moment();
};

const isDescendantOf = (node: LexicalNode, ancestor: LexicalNode): boolean => {
  let current: LexicalNode | null = node;
  while (current) {
    if (current.is(ancestor)) return true;
    current = current.getParent();
  }
  return false;
};

const expectTargetEdge = (editor: IEditor, targetKey: string, edge: 'start' | 'end'): void => {
  editor
    .getLexicalEditor()!
    .getEditorState()
    .read(() => {
      const target = $getNodeByKey(targetKey);
      const selection = $getSelection();
      if (!target || !$isElementNode(target) || !$isRangeSelection(selection))
        throw new Error('Target edge selection missing');
      const expected = edge === 'start' ? target.getFirstDescendant() : target.getLastDescendant();
      if (!expected || !$isTextNode(expected)) throw new Error('Target text edge missing');
      expect(selection.anchor.key).toBe(expected.getKey());
      expect(isDescendantOf(selection.anchor.getNode(), target)).toBe(true);
      expect(selection.anchor.offset).toBe(edge === 'start' ? 0 : expected.getTextContentSize());
    });
};

afterEach(() => {
  while (editors.length > 0) editors.pop()?.destroy();
});

describe('shared Hole target contract', () => {
  it.each(targetCases)('$label registers one transparent Hole boundary', async (targetCase) => {
    const { editor, targetKey } = await createEditorWithTarget(targetCase);
    const lexical = editor.getLexicalEditor()!;
    const hole = getHoleForTarget(editor, targetKey);

    lexical.getEditorState().read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(['paragraph', 'hole', 'paragraph']);
      expect(hole.getContentChildren().map((node) => node.getType())).toEqual([targetCase.type]);
      expect(hole.getBeforeCursor()?.getTextContent()).toBe('\uFEFF');
      expect(hole.getAfterCursor()?.getTextContent()).toBe('\uFEFF');
      expect(hole.getContentChildren()[0]?.getKey()).toBe(targetKey);
    });

    const json = JSON.stringify(editor.getDocument('json'));
    expect(json).not.toContain('"type":"hole"');
    expect(json).toContain(`"type":"${targetCase.type}"`);
  });

  it.each(targetCases)('$label follows common vertical boundary stops', async (targetCase) => {
    const { editor, targetKey } = await createEditorWithTarget(targetCase);
    const lexical = editor.getLexicalEditor()!;
    const hole = getHoleForTarget(editor, targetKey);

    await selectHoleBoundary(editor, hole, 'before');
    await dispatchVerticalArrow(editor, 'up');
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Expected a range selection');
      expect(selection.anchor.getNode().getTextContent()).toBe('before');
      expect(selection.anchor.offset).toBe('before'.length);
    });

    await selectHoleBoundary(editor, hole, 'after');
    await dispatchVerticalArrow(editor, 'down');
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Expected a range selection');
      expect(selection.anchor.getNode().getTextContent()).toBe('after');
      expect(selection.anchor.offset).toBe(0);
    });
  });

  it.each(targetCases)(
    '$label keeps content entry target-owned or falls back to the opposite boundary',
    async (targetCase) => {
      const { editor, targetKey } = await createEditorWithTarget(targetCase);
      const lexical = editor.getLexicalEditor()!;
      const hole = getHoleForTarget(editor, targetKey);

      await selectHoleBoundary(editor, hole, 'before');
      const event = new KeyboardEvent('keydown', { cancelable: true, key: 'ArrowRight' });
      expect(lexical.dispatchCommand(KEY_ARROW_RIGHT_COMMAND, event)).toBe(true);
      expect(event.defaultPrevented).toBe(true);
      await moment();

      lexical.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('Expected a range selection');
        if (targetCase.headlessEntry === 'accept') {
          expect(selection.anchor.getNode()).not.toBe(hole.getBeforeCursor());
          expect(selection.anchor.getNode()).not.toBe(hole.getAfterCursor());
        } else {
          expect(selection.anchor.key).toBe(hole.getAfterCursor()?.getKey());
        }
      });

      if (targetCase.headlessEntry === 'accept') expectTargetEdge(editor, targetKey, 'start');

      await selectHoleBoundary(editor, hole, 'after');
      const reverseEvent = new KeyboardEvent('keydown', { cancelable: true, key: 'ArrowLeft' });
      expect(lexical.dispatchCommand(KEY_ARROW_LEFT_COMMAND, reverseEvent)).toBe(true);
      expect(reverseEvent.defaultPrevented).toBe(true);
      await moment();

      lexical.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('Expected a range selection');
        if (targetCase.headlessEntry === 'accept') {
          expect(selection.anchor.getNode()).not.toBe(hole.getBeforeCursor());
          expect(selection.anchor.getNode()).not.toBe(hole.getAfterCursor());
        } else {
          expect(selection.anchor.key).toBe(hole.getBeforeCursor()?.getKey());
        }
      });
      if (targetCase.headlessEntry === 'accept') expectTargetEdge(editor, targetKey, 'end');
    },
  );

  it('stops at each consecutive Hole before reaching the trailing paragraph', async () => {
    const targetCase = targetCases.find(({ label }) => label === 'artifact');
    if (!targetCase) throw new Error('Artifact contract case is missing');
    const { editor, targetKey } = await createEditorWithTarget(targetCase, true);
    const lexical = editor.getLexicalEditor()!;
    const holes = lexical.getEditorState().read(() => $nodesOfType(HoleNode));
    if (holes.length !== 2) throw new Error('Consecutive Hole fixtures are incomplete');

    await selectHoleBoundary(editor, holes[0]!, 'after');
    await dispatchVerticalArrow(editor, 'down');
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Expected a range selection');
      expect(selection.anchor.key).toBe(holes[1]!.getBeforeCursor()?.getKey());
    });

    lexical.getEditorState().read(() => {
      expect(targetKey).toBe(holes[0]!.getContentChildren()[0]?.getKey());
    });
  });

  it('does not wrap ordinary containers or a collapsible title, while wrapping a supported child', async () => {
    const editor = Editor.createEditor().registerPlugins([CommonPlugin, ListPlugin, ImagePlugin]);
    (editor as IEditorKernel).registerNodes([CollapsibleNode]);
    editors.push(editor);
    editor.initHeadlessEditor();
    const lexical = editor.getLexicalEditor()!;

    lexical.update(
      () => {
        const paragraph = $createParagraphNode().append($createTextNode('paragraph'));
        const heading = $createHeadingNode('h2').append($createTextNode('heading'));
        const listItem = $createListItemNode().append($createTextNode('list'));
        const list = $createListNode('bullet').append(listItem);
        const quote = $createQuoteNode().append($createTextNode('quote'));
        const collapsible = $createCollapsibleNode('Details');
        const title = $createParagraphNode().append($createTextNode('Details'));
        const body = $createParagraphNode().append(
          $createBlockImageNode({
            altText: 'Nested image',
            maxWidth: 640,
            src: 'https://example.test/nested.png',
            width: 320,
          }),
        );
        collapsible.append(title, body);
        $getRoot().append(paragraph, heading, list, quote, collapsible);
      },
      { discrete: true },
    );
    await moment();
    await moment();

    lexical.getEditorState().read(() => {
      const rootChildren = $getRoot().getChildren();
      expect(rootChildren.map((node) => node.getType())).toEqual([
        'paragraph',
        'heading',
        'list',
        'quote',
        'collapsible',
      ]);
      const collapsible = rootChildren.at(-1);
      if (!(collapsible instanceof CollapsibleNode)) throw new Error('Collapsible missing');
      const title = collapsible.getFirstChild();
      const body = collapsible.getLastChild();
      expect(title?.getType()).toBe('paragraph');
      if (!$isElementNode(title)) throw new Error('Collapsible title paragraph missing');
      expect(title.getFirstChild()?.getType()).toBe('text');
      expect(body?.getType()).toBe('hole');
      expect($nodesOfType(HoleNode)).toHaveLength(1);
    });
  });

  it('keeps the common command direction canonical and accepts the legacy edge alias', () => {
    expect(getHoleContentEntrySide({ from: 'before', key: 'target' })).toBe('before');
    expect(getHoleContentEntrySide({ from: 'after', key: 'target' })).toBe('after');
    expect(getHoleContentEntrySide({ edge: 'start', key: 'target' })).toBe('before');
    expect(getHoleContentEntrySide({ edge: 'end', key: 'target' })).toBe('after');
  });
});
