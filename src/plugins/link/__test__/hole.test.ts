import {
  $createParagraphNode,
  $createNodeSelection,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $isElementNode,
  $nodesOfType,
  $setSelection,
  KEY_BACKSPACE_COMMAND,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { $createHoleNode, HoleNode } from '@/plugins/common/node/hole';
import { IHoleService } from '@/plugins/common/service/i-hole-service';
import { $getNodeProperties, $setNodeProperties } from '@/plugins/properties/state';
import { $getNodeId, $setNodeId } from '@/plugins/properties/utils';
import { PropertiesPlugin } from '@/plugins/properties/plugin';

import {
  convertLinkToolbarNodeByKeyToLink,
  replaceNodeByKeyWithBlockCardNode,
  replaceNodeByKeyWithCardNode,
  replaceNodeByKeyWithIframeNode,
} from '../conversion';
import { LinkBlockCardNode } from '../node/LinkBlockCardNode';
import { LinkCardNode } from '../node/LinkCardNode';
import { LinkIframeNode } from '../node/LinkIframeNode';
import { LinkNode } from '../node/LinkNode';
import { SchemaNode } from '../node/SchemaNode';
import { LinkPlugin } from '../plugin';
import { ILinkService, LinkService } from '../service/i-link-service';

const editors: Array<ReturnType<typeof Editor.createEditor>> = [];

afterEach(() => {
  while (editors.length > 0) editors.pop()?.destroy();
});

const createEditor = (withProperties = false): ReturnType<typeof Editor.createEditor> => {
  const editor = Editor.createEditor();
  editor.registerPlugin(CommonPlugin, { enableHotkey: false });
  editor.registerPlugin(LinkPlugin);
  if (withProperties) editor.registerPlugin(PropertiesPlugin);
  editors.push(editor);
  editor.initHeadlessEditor();
  return editor;
};

const getLexical = (editor: ReturnType<typeof Editor.createEditor>) => {
  const lexical = editor.getLexicalEditor();
  if (!lexical) throw new Error('Lexical editor is not initialized');
  return lexical;
};

const getHolePayloadKey = (
  editor: ReturnType<typeof Editor.createEditor>,
  type: string,
): string => {
  const lexical = getLexical(editor);
  const key = lexical.getEditorState().read(() => {
    const hole = $nodesOfType(HoleNode).find((candidate) =>
      candidate.getContentChildren().some((child) => child.getType() === type),
    );
    return hole?.getContentChildren()[0]?.getKey();
  });
  if (!key) throw new Error(`${type} Hole is missing`);
  return key;
};

describe('link block previews and Hole boundaries', () => {
  it('wraps only block preview variants while leaving inline/schema links alone', async () => {
    const editor = createEditor();
    const lexical = getLexical(editor);

    await lexical.update(() => {
      const paragraph = $createParagraphNode();
      const inlineCard = new LinkCardNode('https://example.com/card', 'Inline card');
      const inlineLink = new LinkNode('https://example.com/link', { title: 'Inline link' });
      inlineLink.append($createTextNode('Inline link'));
      const schema = new SchemaNode('schema://example/card', 'card', { id: 1 }, 'Schema link');
      paragraph.append(inlineCard, inlineLink, schema);
      $getRoot().append(
        paragraph,
        new LinkBlockCardNode('https://example.com/block', 'Block card'),
        new LinkIframeNode('https://example.com/iframe', undefined, 'Iframe'),
      );
    });
    await moment();

    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(2);
      expect($nodesOfType(LinkBlockCardNode)).toHaveLength(1);
      expect($nodesOfType(LinkIframeNode)).toHaveLength(1);
      expect($nodesOfType(LinkCardNode)).toHaveLength(1);
      expect($nodesOfType(LinkNode)).toHaveLength(1);
      expect($nodesOfType(SchemaNode)).toHaveLength(1);

      const paragraph = $getRoot().getFirstChild();
      if (!$isElementNode(paragraph)) throw new Error('Inline links paragraph is missing');
      expect(paragraph.getType()).toBe('paragraph');
      expect(paragraph.getChildren().map((node) => node.getType())).toEqual([
        'link-card',
        'link',
        'schema-link',
      ]);
    });
  });

  it('serializes a block preview title through the shared clipboard contract', async () => {
    const editor = createEditor();
    const lexical = getLexical(editor);
    const holeService = editor.requireService(IHoleService);
    if (!holeService) throw new Error('Hole service is unavailable');

    let cardKey = '';
    await lexical.update(() => {
      const card = new LinkBlockCardNode('https://example.com/block', 'Block title');
      cardKey = card.getKey();
      $getRoot().append(card);
    });
    await moment();

    const text = lexical.getEditorState().read(() => {
      const card = $getNodeByKey(cardKey);
      if (!(card instanceof LinkBlockCardNode)) throw new Error('Block card is missing');
      return holeService.serializeTextContent([card], {
        editor: lexical,
        selection: $createNodeSelection(),
      });
    });
    expect(text).toBe('Block title');
  });

  it('deletes a block preview as one shared Hole unit', async () => {
    const editor = createEditor();
    const lexical = getLexical(editor);

    await lexical.update(() => {
      const before = $createParagraphNode();
      before.append($createTextNode('before'));
      const after = $createParagraphNode();
      after.append($createTextNode('after'));
      $getRoot().append(
        before,
        new LinkIframeNode('https://example.com/iframe', undefined, 'Iframe'),
        after,
      );
    });
    await moment();

    const iframeKey = getHolePayloadKey(editor, LinkIframeNode.getType());
    lexical.update(
      () => {
        const selection = $createNodeSelection();
        selection.add(iframeKey);
        $setSelection(selection);
      },
      { discrete: true },
    );
    const event = new KeyboardEvent('keydown', { cancelable: true, key: 'Backspace' });
    expect(lexical.dispatchCommand(KEY_BACKSPACE_COMMAND, event)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    await moment();

    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(0);
      expect($nodesOfType(LinkIframeNode)).toHaveLength(0);
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getTextContent()),
      ).toEqual(['before', 'after']);
    });
  });

  it.each([
    { label: 'first of two', payloadCount: 2, targetIndex: 0 },
    { label: 'last of two', payloadCount: 2, targetIndex: 1 },
    { label: 'first of three', payloadCount: 3, targetIndex: 0 },
    { label: 'middle of three', payloadCount: 3, targetIndex: 1 },
    { label: 'last of three', payloadCount: 3, targetIndex: 2 },
  ])(
    'splits a multi-payload Hole without dropping the $label payloads, keys, IDs, or annotations',
    async ({ payloadCount, targetIndex }) => {
      const editor = createEditor(true);
      const lexical = getLexical(editor);
      let targetKey = '';
      let holeKey = '';
      const payloadKeys: string[] = [];
      const payloadIds: string[] = [];
      const annotationIds: string[] = [];

      await lexical.update(() => {
        const payloads: Array<LinkBlockCardNode | LinkIframeNode> = Array.from(
          { length: payloadCount },
          (_, index) =>
            index === targetIndex
              ? new LinkBlockCardNode(`https://example.com/target-${index}`, `Target ${index}`)
              : new LinkIframeNode(
                  `https://example.com/payload-${index}`,
                  undefined,
                  `Payload ${index}`,
                ),
        );
        payloads.forEach((payload, index) => {
          const nodeId = `link-payload-${index}-id`;
          const annotationId = `link-payload-${index}-annotation`;
          payloadKeys.push(payload.getKey());
          payloadIds.push(nodeId);
          annotationIds.push(annotationId);
          $setNodeId(payload, nodeId);
          $setNodeProperties(payload, { annotationIds: [annotationId] });
          if (index === targetIndex) targetKey = payload.getKey();
        });

        const hole = $createHoleNode(payloads);
        holeKey = hole.getKey();
        $getRoot().append(hole);
      });
      await moment();
      lexical.getEditorState().read(() => {
        payloadKeys.forEach((key, index) => {
          const payload = $getNodeByKey(key);
          if (!payload) throw new Error('Multi-payload payload missing after insertion');
          payloadIds[index] = $getNodeId(payload) || payloadIds[index];
        });
      });

      const linkKey = convertLinkToolbarNodeByKeyToLink(lexical, targetKey);
      expect(linkKey).not.toBeNull();
      await moment();

      lexical.getEditorState().read(() => {
        const rootChildren = $getRoot().getChildren();
        const expectedRootTypes =
          targetIndex === 0
            ? ['paragraph', 'hole']
            : targetIndex === payloadCount - 1
              ? ['hole', 'paragraph']
              : ['hole', 'paragraph', 'hole'];
        expect(rootChildren.map((node) => node.getType())).toEqual(expectedRootTypes);

        const logicalKeys: string[] = [];
        let preservedHoleFound = false;
        rootChildren.forEach((child) => {
          if (child instanceof HoleNode) {
            if (child.getKey() === holeKey) preservedHoleFound = true;
            logicalKeys.push(...child.getContentChildren().map((node) => node.getKey()));
            return;
          }
          if (!$isElementNode(child) || child.getType() !== 'paragraph') {
            throw new Error('Inline replacement paragraph is missing');
          }
          expect(child.getFirstChild()?.getKey()).toBe(linkKey);
          logicalKeys.push(linkKey!);
        });

        expect(preservedHoleFound).toBe(true);
        expect(logicalKeys).toEqual(
          payloadKeys.map((key, index) => (index === targetIndex ? linkKey : key)),
        );
        expect($getNodeByKey(targetKey)).toBeNull();
        expect($getNodeId($getNodeByKey(linkKey!)!)).toBe(payloadIds[targetIndex]);
        expect($getNodeProperties($getNodeByKey(linkKey!)!).annotationIds).toEqual([
          annotationIds[targetIndex],
        ]);

        payloadKeys.forEach((key, index) => {
          if (index === targetIndex) return;
          const payload = $getNodeByKey(key);
          expect(payload).not.toBeNull();
          expect($getNodeId(payload!)).toBe(payloadIds[index]);
          expect($getNodeProperties(payload!).annotationIds).toEqual([annotationIds[index]]);
        });
      });
    },
  );

  it('preserves the logical ID across block preview swaps', async () => {
    const editor = createEditor(true);
    const lexical = getLexical(editor);
    const linkService = editor.requireService(ILinkService) as LinkService;
    let blockKey = '';

    await lexical.update(() => {
      const block = new LinkBlockCardNode('https://example.com/block', 'Block');
      blockKey = block.getKey();
      $setNodeId(block, 'stable-link-block-id');
      $getRoot().append(block);
    });
    await moment();

    const blockPayloadKey = getHolePayloadKey(editor, LinkBlockCardNode.getType());
    expect(blockPayloadKey).toBe(blockKey);
    replaceNodeByKeyWithIframeNode(lexical, blockPayloadKey, linkService);
    await moment();

    const iframeKey = getHolePayloadKey(editor, LinkIframeNode.getType());
    lexical.getEditorState().read(() => {
      expect($getNodeId($getNodeByKey(iframeKey)!)).toBe('stable-link-block-id');
    });

    await replaceNodeByKeyWithBlockCardNode(lexical, iframeKey, linkService);
    await moment();
    const replacementKey = getHolePayloadKey(editor, LinkBlockCardNode.getType());
    lexical.getEditorState().read(() => {
      expect($getNodeId($getNodeByKey(replacementKey)!)).toBe('stable-link-block-id');
    });

    const linkKey = convertLinkToolbarNodeByKeyToLink(lexical, replacementKey);
    expect(linkKey).not.toBeNull();
    await moment();
    lexical.getEditorState().read(() => {
      expect($getNodeId($getNodeByKey(linkKey!)!)).toBe('stable-link-block-id');
    });

    await replaceNodeByKeyWithBlockCardNode(lexical, linkKey!, linkService);
    await moment();
    const roundTripKey = getHolePayloadKey(editor, LinkBlockCardNode.getType());
    lexical.getEditorState().read(() => {
      expect($getNodeId($getNodeByKey(roundTripKey)!)).toBe('stable-link-block-id');
    });
  });

  it('removes the Hole when a block preview becomes inline and preserves it for block swaps', async () => {
    const editor = createEditor();
    const lexical = getLexical(editor);
    const linkService = editor.requireService(ILinkService) as LinkService;

    await lexical.update(() => {
      $getRoot().append(new LinkBlockCardNode('https://example.com/block', 'Block card'));
    });
    await moment();

    let blockKey = '';
    blockKey = getHolePayloadKey(editor, LinkBlockCardNode.getType());

    const linkKey = convertLinkToolbarNodeByKeyToLink(lexical, blockKey);
    expect(linkKey).not.toBeNull();
    await moment();
    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(0);
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(['paragraph']);
      const paragraph = $getRoot().getFirstChild();
      expect($isElementNode(paragraph) ? paragraph.getFirstChild()?.getType() : null).toBe('link');
    });

    await replaceNodeByKeyWithBlockCardNode(lexical, linkKey!, linkService);
    await moment();
    const blockCardKey = getHolePayloadKey(editor, LinkBlockCardNode.getType());
    lexical.getEditorState().read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(['hole']);
    });

    replaceNodeByKeyWithIframeNode(lexical, blockCardKey, linkService);
    await moment();
    const iframeKey = getHolePayloadKey(editor, LinkIframeNode.getType());
    lexical.getEditorState().read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(['hole']);
    });

    await replaceNodeByKeyWithCardNode(lexical, iframeKey, linkService);
    await moment();
    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(0);
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(['paragraph']);
      const paragraph = $getRoot().getFirstChild();
      expect($isElementNode(paragraph) ? paragraph.getFirstChild() : null).toBeInstanceOf(
        LinkCardNode,
      );
    });
  });
});
