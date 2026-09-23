// @vitest-environment node
import { ListItemNode, ListNode } from '@lexical/list';
import { $createTableNodeWithDimensions } from '@lexical/table';
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  INSERT_PARAGRAPH_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { LoroDoc } from 'loro-crdt';
import { describe, expect, it } from 'vitest';

import { createHeadlessEditor } from '@/headless';
import { createLoroHeadlessBinding } from '@/headless/loro';
import { $createArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { $createCodeMirrorNode } from '@/plugins/codemirror-block/node/CodeMirrorNode';
import { $createCollapsibleNode } from '@/plugins/collapsible/node/CollapsibleNode';
import { $isHoleNode } from '@/plugins/common/node/hole';
import { $getLogicalChildren } from '@/plugins/common/node/logical-children';
import { $createBlockFileNode } from '@/plugins/file/node/BlockFileNode';
import { $createFileNode } from '@/plugins/file/node/FileNode';
import { $createHorizontalRuleNode } from '@/plugins/hr/node/HorizontalRuleNode';
import { $createBlockImageNode } from '@/plugins/image/node/block-image-node';
import { $createImageNode } from '@/plugins/image/node/image-node';
import { $createLinkBlockCardNode } from '@/plugins/link/node/LinkBlockCardNode';
import { $createLinkCardNode } from '@/plugins/link/node/LinkCardNode';
import { $createLinkIframeNode } from '@/plugins/link/node/LinkIframeNode';
import { $createAutoLinkNode, $createLinkNode } from '@/plugins/link/node/LinkNode';
import { $createSchemaNode } from '@/plugins/link/node/SchemaNode';
import { $createDiffNode } from '@/plugins/litexml/node/DiffNode';
import { $createMathBlockNode, $createMathInlineNode } from '@/plugins/math/node';
import { $createMentionNode } from '@/plugins/mention/node/MentionNode';
import {
  $clearStreamingGenerationRegion,
  $markNodeAsStreamingGenerationRegion,
  $markNodesAsAIGenerated,
  $prepareCopiedNode,
  $setNodeProperties,
} from '@/plugins/properties';
import { $getNodeProperties } from '@/plugins/properties/state';

import { LORO_CAPABILITY_MATRIX } from '../capabilities';
import { LoroCanonicalDocument, registerLoroHistory } from '../index';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const topLevelTypes = (editor: ReturnType<typeof createHeadlessEditor>): string[] =>
  editor.kernel
    .getLexicalEditor()!
    .getEditorState()
    .read(() => $getLogicalChildren($getRoot()).map((node) => node.getType()));

describe('Loro binding with the real headless plugin registry', () => {
  it('matches the capability matrix against the real default headless node registry', () => {
    const editor = createHeadlessEditor();
    const lexical = editor.kernel.getLexicalEditor()! as unknown as {
      _nodes?: Map<string, unknown>;
    };
    const registeredTypes = Array.from(lexical._nodes?.keys() ?? []);
    expect(registeredTypes).toEqual(
      expect.arrayContaining(LORO_CAPABILITY_MATRIX.map((entry) => entry.type)),
    );
    expect(['root', 'text', 'linebreak', 'cursor', 'hole']).toEqual(
      expect.not.arrayContaining(LORO_CAPABILITY_MATRIX.map((entry) => entry.type)),
    );
    editor.destroy();
  });

  it('hydrates inline code and autolink from Markdown, then copies SchemaNode through reload', async () => {
    const left = createHeadlessEditor({
      initialValue: {
        content: '`inline code` https://example.test\n',
        type: 'markdown',
      },
    });
    const lexical = left.kernel.getLexicalEditor()!;
    await settle();
    lexical.update(() => {
      $getRoot().append(
        $createSchemaNode({
          schemaType: 'Thing',
          title: 'Schema',
          url: 'https://example.test/schema',
        }),
        $createAutoLinkNode('https://example.test/auto'),
      );
    });
    await settle();
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = createLoroHeadlessBinding({ doc: leftDoc, editor: left });
    await settle();
    expect(leftDoc.getNodes().map((node) => leftDoc.readNode(node).type)).toEqual(
      expect.arrayContaining(['codeInline', 'link', 'autolink', 'schema-link']),
    );
    expect(
      leftDoc
        .getNodes()
        .map((node) => leftDoc.readNode(node).flow?.toString() ?? '')
        .join(''),
    ).not.toContain('\uFEFF');

    const copied = createHeadlessEditor();
    const copiedLexical = copied.kernel.getLexicalEditor()!;
    copiedLexical.update(() => {
      const schema = $createSchemaNode({
        schemaType: 'Thing',
        title: 'Copied schema',
        url: 'https://example.test/copied',
      });
      $prepareCopiedNode(schema);
      $getRoot().append(schema);
    });
    await settle();
    const copiedBinding = createLoroHeadlessBinding({
      doc: new LoroCanonicalDocument(new LoroDoc()),
      editor: copied,
    });
    await settle();
    expect(
      copiedBinding.canonical.getNodes().map((node) => copiedBinding.canonical.readNode(node).type),
    ).toContain('schema-link');

    const reload = createHeadlessEditor();
    const reloadDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(leftBinding.exportSnapshot()));
    const reloadBinding = createLoroHeadlessBinding({ doc: reloadDoc, editor: reload });
    await settle();
    expect(reloadDoc.getNodes().map((node) => reloadDoc.readNode(node).type)).toEqual(
      expect.arrayContaining(['codeInline', 'link', 'autolink', 'schema-link']),
    );
    const reloadedCodeChildren = reload.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const code = ($getRoot().getFirstChild() as any)
          .getChildren()
          .find((node: any) => node.getType() === 'codeInline');
        return code?.getChildren().map((node: any) => node.getType()) ?? [];
      });
    expect(reloadedCodeChildren).toContain('cursor');

    leftBinding.dispose();
    copiedBinding.dispose();
    reloadBinding.dispose();
    left.destroy();
    copied.destroy();
    reload.destroy();
  });

  it('round-trips nested lists through two real headless peers and reloads the snapshot', async () => {
    const left = createHeadlessEditor({
      initialValue: {
        content: '- first item\n  1. nested item\n- second item\n',
        type: 'markdown',
      },
    });
    const lexical = left.kernel.getLexicalEditor()!;
    await settle();

    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = createLoroHeadlessBinding({ doc: leftDoc, editor: left });
    await settle();
    expect(leftDoc.getNodes().map((node) => leftDoc.readNode(node).type)).toEqual(
      expect.arrayContaining([ListNode.getType(), ListItemNode.getType()]),
    );

    const right = createHeadlessEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(leftBinding.exportSnapshot()));
    const rightBinding = createLoroHeadlessBinding({ doc: rightDoc, editor: right });
    await settle();
    expect(
      right.kernel
        .getLexicalEditor()!
        .getEditorState()
        .read(() => $getRoot().getTextContent()),
    ).toContain('nested item');

    const version = leftDoc.doc.version();
    lexical.update(() => {
      const nestedText = $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent() === 'nested item');
      nestedText?.setTextContent('nested remote edit');
    });
    await settle();
    rightBinding.applyUpdate(leftDoc.exportUpdate(version));
    await settle();
    expect(
      right.kernel
        .getLexicalEditor()!
        .getEditorState()
        .read(() => $getRoot().getTextContent()),
    ).toContain('nested remote edit');

    const reload = createHeadlessEditor();
    const reloadDoc = new LoroCanonicalDocument(
      LoroDoc.fromSnapshot(rightBinding.exportSnapshot()),
    );
    const reloadBinding = createLoroHeadlessBinding({ doc: reloadDoc, editor: reload });
    await settle();
    expect(
      reload.kernel
        .getLexicalEditor()!
        .getEditorState()
        .read(() => $getRoot().getTextContent()),
    ).toContain('nested remote edit');

    leftBinding.dispose();
    rightBinding.dispose();
    reloadBinding.dispose();
    left.destroy();
    right.destroy();
    reload.destroy();
  });

  it('round-trips registered block capabilities and their attrs across real peers and reload', async () => {
    const left = createHeadlessEditor();
    const lexical = left.kernel.getLexicalEditor()!;
    lexical.update(() => {
      $getRoot().append(
        $createBlockImageNode({
          altText: 'diagram',
          maxWidth: 1200,
          src: 'https://img.test/a.png',
        }),
        $createBlockFileNode('report.pdf', 'https://files.test/report.pdf', 42, 'uploaded'),
        $createMathBlockNode('x^2 + y^2'),
        $createLinkBlockCardNode({ title: 'Card', url: 'https://example.test/card' }),
        $createLinkIframeNode({
          src: 'https://example.test/embed',
          title: 'Frame',
          url: 'https://example.test',
        }),
        $createCollapsibleNode('Details', true),
        $createDiffNode('add'),
      );
    });
    await settle();

    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = createLoroHeadlessBinding({ doc: leftDoc, editor: left });
    await settle();
    const expectedTypes = [
      'block-image',
      'block-file',
      'mathBlock',
      'link-block-card',
      'link-iframe',
      'collapsible',
      'diff',
    ];
    expect(leftDoc.getNodes().map((node) => leftDoc.readNode(node).type)).toEqual(
      expect.arrayContaining(expectedTypes),
    );

    const right = createHeadlessEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(leftBinding.exportSnapshot()));
    const rightBinding = createLoroHeadlessBinding({ doc: rightDoc, editor: right });
    await settle();
    const rightTypes = right.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => $getLogicalChildren($getRoot()).map((node) => node.getType()));
    expect(rightTypes).toEqual(expect.arrayContaining(expectedTypes));

    const version = leftDoc.doc.version();
    lexical.update(() => {
      const nodes = $getLogicalChildren($getRoot());
      const image = nodes.find((node) => node.getType() === 'block-image') as any;
      const file = nodes.find((node) => node.getType() === 'block-file') as any;
      const math = nodes.find((node) => node.getType() === 'mathBlock') as any;
      const card = nodes.find((node) => node.getType() === 'link-block-card') as any;
      const iframe = nodes.find((node) => node.getType() === 'link-iframe') as any;
      const collapsible = nodes.find((node) => node.getType() === 'collapsible') as any;
      image.setSrc('https://img.test/b.png');
      file.setUploaded('https://files.test/next.pdf');
      math.updateCode('x^3');
      card.setTitle('Updated card');
      iframe.setTitle('Updated frame');
      collapsible.setCollapsed(false);
    });
    await settle();
    rightBinding.applyUpdate(leftDoc.exportUpdate(version));
    await settle();

    const projected = right.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const nodes = $getLogicalChildren($getRoot()) as any[];
        return {
          card: nodes.find((node) => node.getType() === 'link-block-card')?.getTitle(),
          file: nodes.find((node) => node.getType() === 'block-file')?.fileUrl,
          image: nodes.find((node) => node.getType() === 'block-image')?.src,
          math: nodes.find((node) => node.getType() === 'mathBlock')?.code,
        };
      });
    expect(projected).toEqual({
      card: 'Updated card',
      file: 'https://files.test/next.pdf',
      image: 'https://img.test/b.png',
      math: 'x^3',
    });

    const reload = createHeadlessEditor();
    const reloadDoc = new LoroCanonicalDocument(
      LoroDoc.fromSnapshot(rightBinding.exportSnapshot()),
    );
    const reloadBinding = createLoroHeadlessBinding({ doc: reloadDoc, editor: reload });
    await settle();
    expect(reloadDoc.getNodes().map((node) => reloadDoc.readNode(node).type)).toEqual(
      expect.arrayContaining(expectedTypes),
    );

    leftBinding.dispose();
    rightBinding.dispose();
    reloadBinding.dispose();
    left.destroy();
    right.destroy();
    reload.destroy();
  });

  it('uses registered HR, Artifact, Table and Hole targets without persisting runtime wrappers', async () => {
    const left = createHeadlessEditor();
    const lexical = left.kernel.getLexicalEditor()!;
    lexical.update(() => {
      $getRoot().append(
        $createHorizontalRuleNode(),
        $createCodeMirrorNode('javascript', 'const x = 1;'),
        $createArtifactNode('<main>artifact</main>', 'Artifact'),
        $createTableNodeWithDimensions(1, 1, false),
      );
    });
    await settle();

    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = createLoroHeadlessBinding({ doc: leftDoc, editor: left });
    await settle();
    const canonicalTypes = leftDoc.getNodes().map((node) => leftDoc.readNode(node).type);
    expect(canonicalTypes).toEqual(
      expect.arrayContaining(['horizontalrule', 'code', 'artifact', 'table']),
    );
    expect(canonicalTypes).not.toContain('hole');
    expect(canonicalTypes).not.toContain('cursor');

    const right = createHeadlessEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(leftBinding.exportSnapshot()));
    const rightBinding = createLoroHeadlessBinding({ doc: rightDoc, editor: right });
    await settle();
    expect(topLevelTypes(right)).toEqual(
      expect.arrayContaining(['horizontalrule', 'code', 'artifact', 'table']),
    );

    const rightArtifactIdentity = right.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const hole = $getRoot()
          .getChildren()
          .find(
            (node) =>
              $isHoleNode(node) &&
              node.getContentChildren().some((child) => child.getType() === 'artifact'),
          );
        return {
          artifactKey:
            hole && $isHoleNode(hole) ? hole.getContentChildren()[0]?.getKey() : undefined,
          holeKey: hole?.getKey(),
        };
      });
    expect(rightArtifactIdentity.holeKey).toBeTruthy();
    expect(rightArtifactIdentity.artifactKey).toBeTruthy();
    const holeKey = rightArtifactIdentity.holeKey;
    const artifactKey = rightArtifactIdentity.artifactKey;

    const version = leftDoc.doc.version();
    lexical.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('after')));
    });
    await settle();
    rightBinding.applyUpdate(leftDoc.exportUpdate(version));
    await settle();
    const preservedArtifactIdentity = right.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const hole = $getRoot()
          .getChildren()
          .find(
            (node) =>
              $isHoleNode(node) &&
              node.getContentChildren().some((child) => child.getType() === 'artifact'),
          );
        return {
          artifactKey:
            hole && $isHoleNode(hole) ? hole.getContentChildren()[0]?.getKey() : undefined,
          holeKey: hole?.getKey(),
        };
      });
    expect(preservedArtifactIdentity.holeKey).toBe(holeKey);
    expect(preservedArtifactIdentity.artifactKey).toBe(artifactKey);

    const deleteVersion = leftDoc.doc.version();
    lexical.update(() => {
      const hole = $getRoot()
        .getChildren()
        .find(
          (node) =>
            $isHoleNode(node) &&
            node.getContentChildren().some((child) => child.getType() === 'artifact'),
        );
      if ($isHoleNode(hole)) {
        hole
          .getContentChildren()
          .find((child) => child.getType() === 'artifact')
          ?.remove();
      }
    });
    await settle();
    rightBinding.applyUpdate(leftDoc.exportUpdate(deleteVersion));
    await settle();
    expect(topLevelTypes(right)).not.toContain('artifact');

    leftBinding.dispose();
    rightBinding.dispose();
    left.destroy();
    right.destroy();
  });

  it('preserves mixed block order and text across snapshot reload', async () => {
    const left = createHeadlessEditor();
    const lexical = left.kernel.getLexicalEditor()!;
    lexical.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('seed')));
    });
    await settle();

    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = createLoroHeadlessBinding({ doc: leftDoc, editor: left });
    await settle();
    lexical.update(() => {
      const seed = $getRoot().getFirstChild();
      const seedText = $isElementNode(seed) ? seed.getFirstChild() : null;
      if ($isTextNode(seedText)) {
        seedText.setTextContent('seed Loro UI block begin');
      }
      const table = $createTableNodeWithDimensions(2, 2, false);
      const values = ['A1', 'A2', 'B1', 'B2'];
      let valueIndex = 0;
      table.getChildren().forEach((row) => {
        if (!$isElementNode(row)) return;
        row.getChildren().forEach((cell) => {
          if (!$isElementNode(cell)) return;
          cell.append($createParagraphNode().append($createTextNode(values[valueIndex++])));
        });
      });
      $getRoot().append(
        $createHorizontalRuleNode(),
        $createParagraphNode().append($createTextNode('After HR')),
        table,
        $createParagraphNode().append($createTextNode('After table')),
        $createCodeMirrorNode('javascript', 'const alpha=1;\nconst omega=2;'),
        $createParagraphNode().append($createTextNode('Loro UI block end')),
      );
    });
    await settle();
    const readBlocks = (editor: ReturnType<typeof createHeadlessEditor>) =>
      editor.kernel
        .getLexicalEditor()!
        .getEditorState()
        .read(() =>
          $getLogicalChildren($getRoot()).map((node) => ({
            text: node.getTextContent(),
            type: node.getType(),
          })),
        );
    const leftBlocks = readBlocks(left);
    expect(leftBlocks.map(({ type }) => type)).toEqual([
      'paragraph',
      'horizontalrule',
      'paragraph',
      'table',
      'paragraph',
      'code',
      'paragraph',
    ]);

    const reload = createHeadlessEditor();
    const reloadBinding = createLoroHeadlessBinding({
      doc: new LoroCanonicalDocument(LoroDoc.fromSnapshot(leftBinding.exportSnapshot())),
      editor: reload,
    });
    await settle();
    expect(readBlocks(reload)).toEqual(leftBlocks);

    leftBinding.dispose();
    reloadBinding.dispose();
    left.destroy();
    reload.destroy();
  });

  it('round-trips inline link/mention/math/image identity and mixed flow order across peers', async () => {
    const left = createHeadlessEditor();
    const lexical = left.kernel.getLexicalEditor()!;
    lexical.update(() => {
      const paragraph = $createParagraphNode();
      paragraph.append(
        $createTextNode('A😀 '),
        $createLinkNode('https://example.test', { title: 'link' }).append($createTextNode('link')),
        $createTextNode(' B '),
        $createMentionNode('Ada', { id: '42' }),
        $createTextNode(' '),
        $createMathInlineNode('x^2'),
        $createTextNode(' '),
        $createImageNode({ altText: 'tiny', maxWidth: 100, src: 'https://img.test/a.png' }),
        $createFileNode('inline.txt', 'https://files.test/inline.txt', 3, 'uploaded'),
        $createLinkCardNode({ title: 'Inline card', url: 'https://example.test/inline-card' }),
        $createTextNode(' C'),
      );
      $getRoot().append(paragraph, $createParagraphNode().append($createTextNode('after')));
    });
    await settle();

    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = createLoroHeadlessBinding({ doc: leftDoc, editor: left });
    await settle();
    const inlineTypes = leftDoc
      .getNodes()
      .map((node) => leftDoc.readNode(node).type)
      .filter((type) => ['link', 'mention', 'math', 'image'].includes(type));
    expect(inlineTypes).toEqual(expect.arrayContaining(['link', 'mention', 'math', 'image']));

    const right = createHeadlessEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(leftBinding.exportSnapshot()));
    const rightBinding = createLoroHeadlessBinding({ doc: rightDoc, editor: right });
    await settle();
    const readInlineOrder = (editor: typeof left) =>
      editor.kernel
        .getLexicalEditor()!
        .getEditorState()
        .read(() => {
          const paragraph = $getRoot().getFirstChild() as any;
          return paragraph.getChildren().map((node: any) => node.getType());
        });
    const order = readInlineOrder(right);
    expect(order).toEqual([
      'text',
      'link',
      'text',
      'mention',
      'text',
      'math',
      'text',
      'image',
      'file',
      'link-card',
      'text',
    ]);

    right.kernel.getLexicalEditor()!.update(() => {
      const paragraph = $getRoot().getFirstChild() as any;
      const link = paragraph.getChildren()[1] as any;
      const last = paragraph.getLastChild() as any;
      const selection = $createRangeSelection();
      selection.setTextNodeRange(link.getFirstChild(), 1, last, 2);
      $setSelection(selection);
    });
    await settle();
    const selectionBefore = rightBinding.captureSelection();
    expect(selectionBefore).not.toBeNull();

    const version = leftDoc.doc.version();
    lexical.update(() => {
      const first = $getRoot().getFirstChild() as any;
      first.getFirstChild().setTextContent('XA😀 ');
      const paragraph = $getRoot().getFirstChild() as any;
      const link = paragraph.getChildren().find((node: any) => node.getType() === 'link') as any;
      const mention = paragraph
        .getChildren()
        .find((node: any) => node.getType() === 'mention') as any;
      const math = paragraph.getChildren().find((node: any) => node.getType() === 'math') as any;
      const file = paragraph.getChildren().find((node: any) => node.getType() === 'file') as any;
      const inlineCard = paragraph
        .getChildren()
        .find((node: any) => node.getType() === 'link-card') as any;
      link.setURL('https://example.test/next').setTitle('next link');
      mention.setLabel('Grace');
      math.updateCode('x^3');
      file.setUploaded('https://files.test/inline-next.txt');
      inlineCard.setTitle('Inline next');
    });
    await settle();
    rightBinding.applyUpdate(leftDoc.exportUpdate(version));
    await settle();
    const selectionAfter = right.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return null;
        return {
          anchorParent: selection.anchor.getNode().getParent()?.getType(),
          anchorOffset: selection.anchor.offset,
          focusOffset: selection.focus.offset,
        };
      });
    expect(selectionAfter).toMatchObject({ anchorParent: 'link', anchorOffset: 1 });
    expect(selectionBefore?.anchor.flowNodeId).toBeTruthy();
    const projected = right.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const paragraph = $getRoot().getFirstChild() as any;
        const link = paragraph.getChildren().find((node: any) => node.getType() === 'link') as any;
        const mention = paragraph
          .getChildren()
          .find((node: any) => node.getType() === 'mention') as any;
        const math = paragraph.getChildren().find((node: any) => node.getType() === 'math') as any;
        const file = paragraph.getChildren().find((node: any) => node.getType() === 'file') as any;
        const inlineCard = paragraph
          .getChildren()
          .find((node: any) => node.getType() === 'link-card') as any;
        return {
          card: inlineCard.getTitle(),
          file: file.fileUrl,
          link: link.getURL(),
          mention: mention.label,
          math: math.code,
        };
      });
    expect(projected).toEqual({
      file: 'https://files.test/inline-next.txt',
      card: 'Inline next',
      link: 'https://example.test/next',
      mention: 'Grace',
      math: 'x^3',
    });

    const concurrentVersion = leftDoc.doc.version();
    left.kernel.getLexicalEditor()!.update(() => {
      const paragraph = $getRoot().getFirstChild() as any;
      const link = paragraph.getChildren().find((node: any) => node.getType() === 'link') as any;
      link.setURL('https://example.test/left');
    });
    right.kernel.getLexicalEditor()!.update(() => {
      const paragraph = $getRoot().getFirstChild() as any;
      const link = paragraph.getChildren().find((node: any) => node.getType() === 'link') as any;
      const mention = paragraph
        .getChildren()
        .find((node: any) => node.getType() === 'mention') as any;
      link.getFirstChild().setFormat('bold');
      mention.setMetadata({ id: 'right-peer' });
    });
    await settle();
    leftBinding.applyUpdate(rightDoc.exportUpdate(concurrentVersion));
    rightBinding.applyUpdate(leftDoc.exportUpdate(concurrentVersion));
    await settle();
    const concurrent = right.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const paragraph = $getRoot().getFirstChild() as any;
        const link = paragraph.getChildren().find((node: any) => node.getType() === 'link') as any;
        const mention = paragraph
          .getChildren()
          .find((node: any) => node.getType() === 'mention') as any;
        return {
          bold: link.getFirstChild().getFormat(),
          mention: mention.metadata,
          url: link.getURL(),
        };
      });
    expect(concurrent).toEqual({
      bold: 1,
      mention: { id: 'right-peer' },
      url: 'https://example.test/left',
    });

    const copyVersion = leftDoc.doc.version();
    lexical.update(() => {
      const paragraph = $getRoot().getFirstChild() as any;
      const link = paragraph.getChildren().find((node: any) => node.getType() === 'link') as any;
      const copy = $createLinkNode(link.getURL(), { title: 'copy' }).append(
        $createTextNode('copy'),
      );
      $prepareCopiedNode(copy);
      paragraph.append($createTextNode(' '), copy);
    });
    await settle();
    rightBinding.applyUpdate(leftDoc.exportUpdate(copyVersion));
    await settle();
    const linkIds = rightDoc
      .getNodes()
      .map((node) => rightDoc.readNode(node))
      .filter((node) => node.type === 'link')
      .map((node) => node.properties.inlineId);
    expect(linkIds).toHaveLength(2);
    expect(new Set(linkIds).size).toBe(2);

    const reload = createHeadlessEditor();
    const reloadDoc = new LoroCanonicalDocument(
      LoroDoc.fromSnapshot(rightBinding.exportSnapshot()),
    );
    const reloadBinding = createLoroHeadlessBinding({ doc: reloadDoc, editor: reload });
    await settle();
    expect(readInlineOrder(reload)).toEqual([...order, 'link']);

    leftBinding.dispose();
    rightBinding.dispose();
    reloadBinding.dispose();
    left.destroy();
    right.destroy();
    reload.destroy();
  });

  it('keeps text-level AI provenance and streaming recovery markers across peers and reload', async () => {
    const left = createHeadlessEditor();
    const lexical = left.kernel.getLexicalEditor()!;
    lexical.update(() => {
      const human = $createTextNode('human prefix ');
      const generated = $createTextNode('generated chunk');
      $markNodesAsAIGenerated([generated], {
        generationId: 'generation-1',
        requestId: 'request-1',
        sessionId: 'session-1',
      });
      $markNodeAsStreamingGenerationRegion(generated, {
        generationId: 'generation-1',
        requestId: 'request-1',
        sessionId: 'session-1',
      });
      $getRoot().append($createParagraphNode().append(human, generated));
    });
    await settle();

    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = createLoroHeadlessBinding({ doc: leftDoc, editor: left });
    await settle();
    const snapshot = leftBinding.exportSnapshot();
    const right = createHeadlessEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = createLoroHeadlessBinding({ doc: rightDoc, editor: right });
    await settle();
    const readProperties = (editor: typeof left) =>
      editor.kernel
        .getLexicalEditor()!
        .getEditorState()
        .read(() =>
          ($getRoot().getFirstChild() as any).getChildren().map((node: any) => ({
            properties: $getNodeProperties(node),
            text: node.getTextContent(),
          })),
        );
    const initial = readProperties(right);
    expect(initial[0].properties.provenance).toBeUndefined();
    expect(initial[1].properties.provenance).toMatchObject({
      generationId: 'generation-1',
      source: 'ai',
    });
    expect(initial[1].properties.rewriteRegionStatus).toBe('streaming');

    const reload = createHeadlessEditor();
    const reloadDoc = new LoroCanonicalDocument(
      LoroDoc.fromSnapshot(rightBinding.exportSnapshot()),
    );
    const reloadBinding = createLoroHeadlessBinding({ doc: reloadDoc, editor: reload });
    await settle();
    expect(readProperties(reload)[1].properties.provenance).toMatchObject({
      generationId: 'generation-1',
      source: 'ai',
    });
    expect(readProperties(reload)[1].properties.rewriteRegionStatus).toBe('streaming');

    const concurrentVersion = leftDoc.doc.version();
    lexical.update(() => {
      const generated = ($getRoot().getFirstChild() as any).getLastChild();
      $setNodeProperties(generated, (previous) => ({
        ...previous,
        provenance: { ...previous.provenance, requestId: 'left-provenance' } as any,
      }));
    });
    right.kernel.getLexicalEditor()!.update(() => {
      const generated = ($getRoot().getFirstChild() as any).getLastChild();
      $setNodeProperties(generated, (previous) => ({
        ...previous,
        annotationIds: ['annotation-right'],
      }));
    });
    await settle();
    leftBinding.applyUpdate(rightDoc.exportUpdate(concurrentVersion));
    rightBinding.applyUpdate(leftDoc.exportUpdate(concurrentVersion));
    await settle();
    const mergedProperties = readProperties(right)[1].properties;
    expect(mergedProperties.provenance).toMatchObject({ requestId: 'left-provenance' });
    expect(mergedProperties.annotationIds).toEqual(['annotation-right']);

    const clearVersion = leftDoc.doc.version();
    lexical.update(() => {
      const generated = ($getRoot().getFirstChild() as any).getLastChild();
      $setNodeProperties(generated, (previous) => {
        const next = { ...previous };
        delete next.provenance;
        return next;
      });
    });
    await settle();
    rightBinding.applyUpdate(leftDoc.exportUpdate(clearVersion));
    await settle();
    const clearedProperties = readProperties(right)[1].properties;
    expect(clearedProperties.provenance).toBeUndefined();
    expect(clearedProperties.annotationIds).toEqual(['annotation-right']);

    const nextVersion = leftDoc.doc.version();
    lexical.update(() => {
      const generated = ($getRoot().getFirstChild() as any).getLastChild();
      $clearStreamingGenerationRegion(generated, 'session-1', 'generation-1', 'request-1');
    });
    await settle();
    rightBinding.applyUpdate(leftDoc.exportUpdate(nextVersion));
    await settle();
    const cleared = readProperties(right);
    expect(cleared[0].properties.provenance).toBeUndefined();
    expect(cleared[1].properties.provenance).toBeUndefined();
    expect(cleared[1].properties.rewriteRegionStatus).toBeUndefined();

    leftBinding.dispose();
    rightBinding.dispose();
    reloadBinding.dispose();
    left.destroy();
    right.destroy();
    reload.destroy();
  });

  it('keeps real headless Enter split and typing undo structurally ordered', async () => {
    const editor = createHeadlessEditor({
      initialValue: {
        content: 'abcdef',
        type: 'markdown',
      },
    });
    const lexical = editor.kernel.getLexicalEditor()!;
    const canonical = new LoroCanonicalDocument(new LoroDoc());
    const binding = createLoroHeadlessBinding({ doc: canonical, editor });
    const unregisterHistory = registerLoroHistory(lexical, binding);
    await settle();
    binding.undoManager.clear();

    lexical.update(() => {
      const paragraph = $getRoot().getFirstChild();
      const text = $isElementNode(paragraph) ? paragraph.getFirstChild() : null;
      if (!$isTextNode(text)) return;
      const selection = $createRangeSelection();
      selection.setTextNodeRange(text, 3, text, 3);
      $setSelection(selection);
    });
    await settle();
    lexical.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
    await settle();

    const flowTexts = (): string[] =>
      canonical.getNodes().map((node) => canonical.readNode(node).flow?.toString() ?? '');
    const readSelection = () =>
      lexical.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return null;
        return {
          anchorText: selection.anchor.getNode().getTextContent(),
          anchorOffset: selection.anchor.offset,
          focusText: selection.focus.getNode().getTextContent(),
          focusOffset: selection.focus.offset,
        };
      });
    const afterSplit = flowTexts();
    expect(afterSplit).toEqual(['abc', 'def']);

    lexical.update(() => {
      const paragraph = $getRoot().getLastChild();
      const text = $isElementNode(paragraph) ? paragraph.getFirstChild() : null;
      if (!$isTextNode(text)) return;
      const selection = $createRangeSelection();
      selection.setTextNodeRange(text, 0, text, 0);
      $setSelection(selection);
      selection.insertText('typed');
    });
    await settle();
    expect(flowTexts()).toEqual(['abc', 'typeddef']);
    expect(readSelection()).toMatchObject({ anchorText: 'typeddef', anchorOffset: 5 });

    expect(lexical.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(flowTexts()).toEqual(afterSplit);
    expect(flowTexts().join('')).toBe('abcdef');
    expect(readSelection()).toMatchObject({ anchorText: 'def', anchorOffset: 0 });

    expect(lexical.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(flowTexts()).toEqual(['abcdef']);
    expect(flowTexts().join('')).toBe('abcdef');
    expect(readSelection()).toMatchObject({ anchorText: 'abcdef', anchorOffset: 3 });

    expect(lexical.dispatchCommand(REDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readSelection()).toMatchObject({ anchorText: 'def', anchorOffset: 0 });
    expect(lexical.dispatchCommand(REDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readSelection()).toMatchObject({ anchorText: 'typeddef', anchorOffset: 5 });

    unregisterHistory();
    binding.dispose();
    editor.destroy();
  });
});
